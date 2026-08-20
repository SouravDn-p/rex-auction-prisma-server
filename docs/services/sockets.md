# Socket.IO Real-Time Layer

Real-time bidding, chat, and push notifications run over Socket.IO, sharing the same HTTP server/port as the REST API (`initSocketIO(server)` is called once from `src/main.ts` right after the Express app starts listening).

## Setup

`src/services/sockets/index.ts` creates a single `SocketIOServer`, CORS-restricted to `ENV.ALLOWED_ORIGINS` with `credentials: true` (matching the REST CORS policy in `app.ts`), and registers three namespaces, each with its own connection-time auth middleware:

* `/auction` — [`auction.socket.ts`](../../src/services/sockets/) — live bidding
* `/chat` — [`chat.socket.ts`](../../src/services/sockets/) — direct messaging
* `/notifications` — [`notification.socket.ts`](../../src/services/sockets/) — server-pushed notifications

```ts
// src/main.ts
const server = app.listen(ENV.PORT, () => { /* ... */ });
initSocketIO(server);   // attaches Socket.IO to the same HTTP server
await initWorkers();
```

## Authentication

Every namespace runs `socketAuthMiddleware` on connect:

1. Reads the JWT from `socket.handshake.auth.token` or the `Authorization` header (there's no cookie access during the WS handshake the way there is for REST).
2. Verifies it with `verifyAccessToken` (same secret/util as REST — [`jwt.util.ts`](../../src/app/common/utils/jwt.util.ts)).
3. Resolves the user through the **same** `user:auth:{id}` Redis cache (60s TTL) that `protect` uses for REST — so a role change or deactivation propagates to sockets exactly as fast as it does to REST, once `invalidateUserCache` is called.
4. Rejects the connection if the user is missing or `isActive: false`; otherwise attaches `socket.data = { userId, email, role }`.

## `/auction` namespace — live bidding

Room per auction: `auction:{auctionId}`.

| Event | Direction | Payload | Effect |
| --- | --- | --- | --- |
| `auction:join` | client → server | `{ auctionId }` | Joins the room; ack includes `BiddingService.getAuctionLiveState(auctionId)` plus the caller's own auto-bid config, if any |
| `auction:leave` | client → server | `{ auctionId }` | Leaves the room |
| `bid:place` | client → server | `{ auctionId, amount }` | Validated with `placeBidDtoSchema`, delegates to `BiddingService.placeBid` (identical logic to `POST /bidding/place`) |
| `autobid:set` | client → server | `{ auctionId, maxBid, incrementStep }` | Delegates to `BiddingService.setAutoBid`; if the new auto-bid immediately overtakes the current leader, resolution runs right away |
| `autobid:cancel` | client → server | `{ auctionId }` | Cancels the caller's auto-bid |
| `bid:update` | server → room | `{ auctionId, currentBid, currentBidderId, currentBidderName, isAutoBid, timestamp }` | Broadcast after any successful bid (manual or auto-bid-resolved) |
| `bid:error` | server → caller only | `{ message }` | Emitted back to the socket that triggered a failed `bid:place`/`autobid:set` |
| `auction:started` | server → room | `{ auctionId, status, startTime, endTime }` | Emitted by the BullMQ `auction.processor.ts` worker, not by this file, when the `start-auction` job fires |
| `auction:ended` | server → room | `{ auctionId, status, winnerId, finalPrice }` | Emitted by `auction.processor.ts` when the `end-auction` job fires |

```ts
// src/app/common/jobs/auction.processor.ts
if (job.name === 'end-auction') {
  const result = await AuctionsService.endAuction(auctionId);
  if (result) {
    getIO().of('/auction').to(`auction:${auctionId}`).emit('auction:ended', {
      auctionId, status: 'ended',
      winnerId: result.topBid?.userId ?? null,
      finalPrice: result.ended.finalPrice,
    });
    if (result.topBid?.userId) {
      getIO().of('/notifications').to(`user:${result.topBid.userId}`)
        .emit('notification:new', {
          type: 'auction_won', auctionId,
          message: `You won the auction for ${result.ended.finalPrice}!`,
        });
    }
  }
}
```

Every bid mutation is guarded by a short-lived Redis lock so two near-simultaneous bids on the same auction can't race — see [docs/services/redis.md](./redis.md) and the proxy-bid resolution algorithm documented in the [root README](../../README.md#auto-bid-proxy-bidding-resolution).

## `/chat` namespace — messaging

Room per conversation: `chat:conversation:{conversationId}`.

| Event | Direction | Payload | Effect |
| --- | --- | --- | --- |
| *(connect)* | — | — | `ChatService.setUserOnline(userId)` — adds the user to the Redis `presence:online` set |
| *(disconnect)* | — | — | `ChatService.setUserOffline(userId)` — removes from the presence set, updates `UserPresence.lastSeenAt` |
| `chat:join` | client → server | `{ conversationId }` | Joins the room, marks pending messages `delivered`, acks with the conversation plus its last 50 messages |
| `chat:send` | client → server | `{ conversationId, text }` | Persists via `ChatService.sendMessage`, then broadcasts |
| `chat:typing` | client → server | `{ conversationId, isTyping }` | Relayed to the room (excluding the sender) as `{ userId, isTyping }` |
| `chat:message` | server → room | the persisted `Message` row | Broadcast after `chat:send` |
| `notification:new` | server → `user:{receiverId}` (on `/notifications`) | `{ type: 'new_message', message, senderId, conversationId }` | Cross-namespace push so the receiver is notified even if they don't have the conversation room open |

> **Important:** `POST /chat/messages` (the REST endpoint) persists a message but does **not** emit `chat:message` or the cross-namespace notification — only the `chat:send` socket handler does both. A client relying solely on REST will not see new messages arrive live; it has to poll `GET /chat/messages/:conversationId`. See the "Known Gaps" note in the [root README](../../README.md#-known-gaps--notes-for-contributors) if you're deciding whether to fix this.

## `/notifications` namespace — push only

On connect, a socket is auto-joined to a personal room, `user:{userId}` — there are no client-initiated events on this namespace. It exists purely as a delivery target: `auction.processor.ts` (auction wins) and `chat.socket.ts` (new messages) both push into a user's personal room from elsewhere in the codebase, e.g.:

```ts
io.of('/notifications').to(`user:${userId}`).emit('notification:new', payload);
```

## Client connection sketch

```ts
import { io } from 'socket.io-client';

const auctionSocket = io('http://localhost:5000/auction', {
  auth: { token: accessToken },
  withCredentials: true,
});

auctionSocket.emit('auction:join', { auctionId });
auctionSocket.on('bid:update', (payload) => { /* update UI */ });
auctionSocket.on('bid:error', ({ message }) => { /* show error */ });

auctionSocket.emit('bid:place', { auctionId, amount: 5200 });
```

Each namespace needs its own connection (`io(url + '/auction')`, `io(url + '/chat')`, `io(url + '/notifications')`) — Socket.IO namespaces are logically separate sockets even though they share one underlying transport/port.
