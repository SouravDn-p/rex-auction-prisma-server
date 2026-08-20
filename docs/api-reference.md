# API Reference — Non-Auth Modules

Base path for every route below: `/api/v1`. All routes return the standard `{ success, message, data }` envelope described in the [root README](../README.md#-unified-api-response-schemas). Auth is via the `accessToken` HTTP-only cookie unless noted otherwise — see [Auth guard reference](../README.md#auth-guard-reference) for what `protect` / `optionalProtect` / `restrictTo` / `validateDto` / `validateFormDto` each do.

Authentication and session endpoints (`/auth/*`) are documented separately in [docs/auth/auth.md](./auth/auth.md). Payments (`/payments/*`) are documented in [docs/services/payments.md](./services/payments.md).

---

## Users

Router: [`src/app/modules/users/users.routes.ts`](../src/app/modules/users/users.routes.ts)

| Method | Path | Middleware | Description |
| --- | --- | --- | --- |
| GET | `/users/me` | `protect` | Current user's profile |
| PATCH | `/users/me` | `protect`, `validateDto(updateUserDtoSchema)` | Update profile fields |
| GET | `/users/me/stats` | `protect` | `UserStats` row: `accountBalance`, `auctionsWon`, `activeBids`, `totalSpent` |
| GET | `/users/me/activities` | `protect` | Paginated `UserActivity` feed |
| GET | `/users/me/transactions` | `protect` | Paginated `Transaction` ledger |
| GET | `/users/me/watchlist` | `protect` | Auctions the user is watching |
| POST | `/users/me/watchlist` / `/users/me/watchlist/:auctionId` | `protect` | Add an auction to the watchlist |
| DELETE | `/users/me/watchlist/:auctionId` | `protect` | Remove from the watchlist |
| POST | `/users/me/seller-request` | `protect`, `validateDto(submitSellerRequestDtoSchema)` | Apply to become a seller |
| GET | `/users/admin/users` | `protect`, `restrictTo('ADMIN')` | List/search all users |
| PATCH | `/users/admin/users/:userId/status` | `protect`, `restrictTo('ADMIN')`, `validateDto(updateUserStatusDtoSchema)` | Activate/deactivate a user |
| GET | `/users/admin/seller-requests` | `protect`, `restrictTo('ADMIN')` | List seller applications |
| PATCH | `/users/admin/seller-requests/:requestId/review` | `protect`, `restrictTo('ADMIN')`, `validateDto(reviewSellerRequestDtoSchema)` | Approve/reject a seller application |

**Approving a seller request** promotes `User.role → SELLER` and calls `invalidateUserCache(userId)`, which deletes the `user:auth:{id}` Redis cache entry so `protect` and the socket auth middleware see the new role immediately instead of waiting out the 60s cache TTL.

**Deactivating a user** (`adminUpdateUserStatus`) invalidates the same cache entry and additionally deletes every `refresh` `UserToken` row for that user, forcing logout on all devices.

---

## Auctions

Router: [`src/app/modules/auctions/auctions.routes.ts`](../src/app/modules/auctions/auctions.routes.ts)

| Method | Path | Middleware | Description |
| --- | --- | --- | --- |
| GET | `/auctions/` | none | List/browse auctions (public) |
| GET | `/auctions/seller/mine` | `protect`, `restrictTo('SELLER','ADMIN')` | Auctions created by the current seller |
| GET | `/auctions/:id` | none | Auction detail (public) |
| POST | `/auctions/` | `protect`, `restrictTo('SELLER','ADMIN')`, `validateDto(createAuctionDtoSchema)` | Create an auction (status starts as `pending`) |
| PATCH | `/auctions/:id` | `protect`, `restrictTo('SELLER','ADMIN')`, `validateDto(updateAuctionDtoSchema)` | Update an auction the seller owns |
| DELETE | `/auctions/:id` | `protect`, `restrictTo('SELLER','ADMIN')` | Delete an auction |
| GET | `/auctions/admin/pending` | `protect`, `restrictTo('ADMIN')` | List auctions awaiting admin review |
| PATCH | `/auctions/admin/:id/review` | `protect`, `restrictTo('ADMIN')`, `validateDto(adminReviewAuctionDtoSchema)` | Approve (→ `upcoming`) or reject (→ `cancelled`) |
| POST | `/auctions/:id/reactions` | `protect`, `validateDto(reactionDtoSchema)` | React to an auction (`like`/`love`/`smile`/`wow`/`flag`) |
| DELETE | `/auctions/:id/reactions` | `protect` | Remove your reaction |

### Create auction request body

```json
{
  "title": "1965 Fender Stratocaster",
  "description": "Original finish, one owner.",
  "itemCondition": "used",
  "itemYear": 1965,
  "itemReference": "FEN-1965-STRAT-001",
  "itemValuation": 25000.00,
  "history": "Purchased new in 1965, kept in original case.",
  "images": [{ "url": "https://res.cloudinary.com/.../image1.jpg" }],
  "category": "musical-instruments",
  "startingPrice": 5000.00,
  "startTime": "2026-09-01T10:00:00.000Z",
  "endTime": "2026-09-08T10:00:00.000Z",
  "notes": "Local pickup preferred."
}
```

`images` requires 1–10 entries, each `{ url: string }`. `startTime` must be in the future; `endTime` must be after `startTime`.

### Lifecycle

`pending` (seller submitted) → admin review → `upcoming` (approved, transition jobs scheduled) or `cancelled` (rejected) → `active` (BullMQ `start-auction` job fires at `startTime`) → `ended` (BullMQ `end-auction` job fires at `endTime`, winner computed) → `sold` (payment settled — see [Payments](./services/payments.md)).

`adminReviewAuction` on approval calls `scheduleTransitions(auctionId, startTime, endTime)`, which enqueues two delayed BullMQ jobs on `auctionQueue` with deterministic job IDs (`start-auction-{id}`, `end-auction-{id}`) so re-approving or rejecting later is idempotent/cancellable. See [docs/services/bullmq.md](./services/bullmq.md) and the README's [Background Jobs](../README.md#️-background-jobs-bullmq) section for what each transition does.

---

## Bidding

Router: [`src/app/modules/bidding/bidding.routes.ts`](../src/app/modules/bidding/bidding.routes.ts)

| Method | Path | Middleware | Description |
| --- | --- | --- | --- |
| POST | `/bidding/place` | `protect`, `validateDto(placeBidDtoSchema)` | Place a manual bid |
| POST | `/bidding/autobid` | `protect`, `validateDto(setAutoBidDtoSchema)` | Create/update a proxy (auto) bid |
| GET | `/bidding/autobid/:auctionId` | `protect` | Get your current auto-bid config for an auction |
| DELETE | `/bidding/autobid/:auctionId` | `protect` | Cancel your auto-bid |

```json
// POST /bidding/place
{ "auctionId": "b2f1...-uuid", "amount": 5200.00 }

// POST /bidding/autobid
{ "auctionId": "b2f1...-uuid", "maxBid": 8000.00, "incrementStep": 100.00 }
```

The same `BiddingService` backs both these REST endpoints and the `/auction` Socket.IO namespace's `bid:place`/`autobid:set`/`autobid:cancel` events — see [Real-Time Layer](../README.md#-real-time-layer-socketio) in the README and [docs/services/sockets.md](./services/sockets.md) for the proxy-bid resolution algorithm, per-auction Redis locking, and what gets broadcast after a successful bid.

---

## Blog

Router: [`src/app/modules/blog/blog.routes.ts`](../src/app/modules/blog/blog.routes.ts)

| Method | Path | Middleware | Description |
| --- | --- | --- | --- |
| GET | `/blogs/` | `optionalProtect` | List posts (published-only for anonymous/non-author viewers) |
| GET | `/blogs/tags` | none | Distinct tag list |
| GET | `/blogs/slug/:slug` | none | Post by slug (increments `viewCount`, fire-and-forget) |
| GET | `/blogs/me/blogs` | `protect`, `restrictTo('SELLER','ADMIN')` | Current author's own posts (drafts included) |
| GET | `/blogs/:id` | `optionalProtect` | Post by id |
| POST | `/blogs/` | `protect`, `restrictTo('SELLER','ADMIN')`, `upload.array('images', 5)`, `validateFormDto(createBlogDtoSchema)` | Create a post (requires ≥1 uploaded image) |
| PATCH | `/blogs/:id` | `protect`, `restrictTo('SELLER','ADMIN')`, `upload.array('images', 5)`, `validateFormDto(updateBlogDtoSchema)` | Update a post |
| DELETE | `/blogs/:id` | `protect`, `restrictTo('SELLER','ADMIN')` | Delete a post |
| PATCH | `/blogs/:id/publish` | `protect`, `restrictTo('ADMIN')` | Publish a draft |
| PATCH | `/blogs/:id/unpublish` | `protect`, `restrictTo('ADMIN')` | Unpublish a post |

Notes:

* `create`/`update` slugify the title and append a timestamp/id suffix to keep `slug` unique.
* Tags are stored in a separate `BlogTag` join table; `update` does a `deleteMany` + `createMany` rather than a diff.
* Non-admin, non-author callers never see unpublished drafts, even via `getById`.
* Because this route uses `upload.array` + `validateFormDto`, form fields like `tags` (comma-separated string) and `isActive`/boolean-like fields are coerced from strings before Joi validation runs — see `parseFormFields` in `validate-dto.middleware.ts`.

---

## Announcements

Router: [`src/app/modules/announcements/announcements.routes.ts`](../src/app/modules/announcements/announcements.routes.ts)

| Method | Path | Middleware | Description |
| --- | --- | --- | --- |
| GET | `/announcements/` | `optionalProtect` | List announcements |
| GET | `/announcements/active` | none | Only currently-active announcements |
| GET | `/announcements/:id` | `optionalProtect` | Announcement by id |
| POST | `/announcements/` | `protect`, `restrictTo('ADMIN')`, `upload.single('image')`, `validateFormDto(createAnnouncementDtoSchema)` | Create (admin only) |
| PATCH | `/announcements/:id` | `protect`, `restrictTo('ADMIN')`, `upload.single('image')`, `validateFormDto(updateAnnouncementDtoSchema)` | Update |
| DELETE | `/announcements/:id` | `protect`, `restrictTo('ADMIN')` | Delete |

Straightforward Prisma CRUD — no cache, queue, or socket side effects. `list`/`getById` hide inactive (`isActive: false`) announcements from non-admin callers.

---

## Chat

Router: [`src/app/modules/chat/chat.routes.ts`](../src/app/modules/chat/chat.routes.ts)

| Method | Path | Middleware | Description |
| --- | --- | --- | --- |
| POST | `/chat/conversations/start` | `protect`, `validateDto(startConversationDtoSchema)` | Start/reuse a conversation with another user |
| GET | `/chat/conversations` | `protect` | List the current user's conversations |
| GET | `/chat/conversations/:id` | `protect` | Conversation detail |
| DELETE | `/chat/conversations/:id` | `protect` | Soft-delete (hide) a conversation for the current user |
| POST | `/chat/messages` | `protect`, `validateDto(sendMessageDtoSchema)` | Send a message over REST |
| GET | `/chat/messages/unread-count` | `protect` | Total unread count across conversations |
| GET | `/chat/messages/:conversationId` | `protect` | Message history for a conversation |
| PATCH | `/chat/messages/read` | `protect`, `validateDto(markReadDtoSchema)` | Mark messages as read |
| POST | `/chat/reports/user` | `protect`, `validateDto(reportUserDtoSchema)` | Report another user |

```json
// POST /chat/conversations/start
{ "otherUserId": "uuid", "auctionId": "uuid (optional, tags the conversation as auction-context)" }

// POST /chat/messages
{ "conversationId": "uuid", "text": "Is this still available?" }

// POST /chat/reports/user
{ "reportedUserId": "uuid", "reason": "spam", "description": "optional detail" }
```

Behavior worth knowing:

* Conversations are canonically ordered (`userOneId`/`userTwoId` sorted, smaller id first) with a `@@unique` constraint, so `startConversation` is idempotent — calling it twice for the same pair reuses the existing row.
* Deletion is **soft and per-user** (`deletedByUserOne`/`deletedByUserTwo`); the flags reset to `false` automatically whenever a new message arrives, which brings a "deleted" thread back into both inboxes.
* Presence (`Redis` set `presence:online`) determines whether a new message is stored as `delivered` or `sent`; `UserPresence.lastSeenAt` is only updated when a user goes offline.
* **`POST /chat/messages` does not push the message live.** Only the Socket.IO `chat:send` handler emits `chat:message` to the conversation room and `notification:new` to the receiver's personal room. A REST-only client will need to poll `GET /chat/messages/:conversationId` — see [docs/services/sockets.md](./services/sockets.md) for the live path.
