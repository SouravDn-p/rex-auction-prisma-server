# Redis

Redis (`ioredis`) is the shared low-latency state layer for four distinct purposes in this codebase: auth caching, bidding concurrency control, chat presence, and payment webhook idempotency. It is **not** the source of truth for anything — Postgres/Prisma always is — Redis only accelerates reads and coordinates concurrent writers.

## Environment Variables

```ini
REDIS_URL=redis://localhost:6379
```

> [!WARNING]
> Unlike every other required secret, `REDIS_URL` is **not** validated at startup — [`env.config.ts`](../../src/config/env.config.ts) reads it with a non-null assertion (`process.env.REDIS_URL!`) instead of the `required()` helper used for `DATABASE_URL`, `JWT_ACCESS_SECRET`, etc. A missing value won't throw until the first Redis operation at runtime, not at boot.

## Connection setup

Two separate clients exist, both built from the same `REDIS_URL`:

```ts
// src/config/redis/redis.config.ts
export const redisConnection = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null,
});
redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error('Redis error:', err));

export const bullMqConnection: ConnectionOptions = {
  url: ENV.REDIS_URL,
  maxRetriesPerRequest: null,
};
```

`redisConnection` is the general-purpose `ioredis` client used by application code below; `bullMqConnection` is passed to every BullMQ `Queue`/`Worker` (see [docs/services/bullmq.md](./bullmq.md)) — `maxRetriesPerRequest: null` is required by BullMQ so its blocking commands aren't cut short by ioredis's default retry limit.

## 1. Auth cache

`src/app/common/guards/auth.middleware.ts` caches a lightweight user snapshot under `user:auth:{userId}` (60s TTL):

```ts
{ id, email, role, isActive }
```

* `protect` (REST) and the Socket.IO auth middleware (`/auction`, `/chat`, `/notifications`) both read through this cache instead of hitting Postgres on every request/connection.
* On cache miss, the user is loaded via Prisma and re-cached.
* `invalidateUserCache(userId)` deletes the key — called whenever a user's role or active status changes (seller-request approval, admin activate/deactivate) so the change is visible immediately instead of waiting out the TTL.

## 2. Bidding: locks and live auction state

Per-auction keys, all prefixed `auction:{auctionId}:`:

| Key | Holds | Written by |
| --- | --- | --- |
| `currentBid` | The current leading bid amount | `BiddingService`, seeded on `activateAuction` |
| `currentBidderId` | The current leader's user id | `BiddingService` |
| `autobids` | A hash of `userId → { maxBid, incrementStep }` | `BiddingService.setAutoBid` |
| `lock` | Mutex, `PX 5000 NX` | `withLock` |

```ts
// withLock — src/app/modules/bidding/bidding.service.ts
// SET auction:{id}:lock 1 PX 5000 NX, retried up to 20× at 50ms intervals
```

Every bid mutation (manual bid or auto-bid resolution) runs inside this lock, so two near-simultaneous bids on the same auction are serialized rather than racing on read-then-write. If the lock can't be acquired after all retries, the caller gets a `429 "System busy"` `AppError`. All three keys for an auction are deleted once `AuctionsService.endAuction` finishes, so a settled auction leaves no live-state keys behind.

See the [root README](../../README.md#auto-bid-proxy-bidding-resolution) for the auto-bid resolution algorithm these keys support.

## 3. Chat presence

* `presence:online` — a Redis **set** of currently-connected user ids, maintained by the `/chat` Socket.IO namespace (`sadd` on connect, `srem` on disconnect).
* Used by `ChatService.sendMessage` to decide whether a new message is stored as `delivered` (receiver online) or `sent` (receiver offline) — see `Message.status` in the schema.
* `UserPresence.lastSeenAt` (Postgres) is only written when a user goes **offline** — while online, presence is tracked purely in Redis for speed.

## 4. Payment IPN idempotency

* `payment:ipn:processed:{trxId}` — 24h TTL flag; a repeated SSLCommerz IPN delivery for an already-settled transaction is a no-op.
* `payment:ipn:lock:{trxId}` — `SET NX`, 30s TTL distributed lock; prevents two concurrent IPN deliveries for the same `trxId` from both running `_processPaidTransaction`.
* `payment:trx:{trxId}` — a short-lived cache of payment status, deleted once settlement completes.

See [docs/services/payments.md](./payments.md) for the full settlement flow these keys protect.

## Operational notes

* Redis is a hard runtime dependency: auth (cache-through, but the app degrades gracefully to Postgres on miss), bidding (locks are load-bearing — bidding breaks without Redis), chat presence, and payment IPN idempotency all depend on it being reachable.
* Because `REDIS_URL` isn't validated at boot, a misconfigured environment will pass startup and then fail on first use (first login, first bid, first webhook) — see the [Known Gaps](../../README.md#-known-gaps--notes-for-contributors) section in the root README.
