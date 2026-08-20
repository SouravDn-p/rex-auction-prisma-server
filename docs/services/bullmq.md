# BullMQ

BullMQ powers every background/deferred job in the backend: transactional email delivery, the auction start/end lifecycle, and stale-session cleanup. All queues share the `bullMqConnection` Redis connection ([`src/config/redis/redis.config.ts`](../../src/config/redis/redis.config.ts)).

## Queues

Defined in [`src/config/bull/queue.config.ts`](../../src/config/bull/queue.config.ts):

```ts
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  TOKEN_CLEANUP: 'token-cleanup-queue',
  AUCTION: 'auction-queue',
} as const;

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
});
```

`tokenCleanupQueue` and `auctionQueue` are defined the same way (`auctionQueue` uses a shorter 3s exponential backoff, since its jobs are time-critical — see below).

## How workers are wired up

[`src/app/common/jobs/index.ts`](../../src/app/common/jobs/index.ts) registers all three workers purely as import side effects, then schedules the one repeatable job:

```ts
import './email.processor.ts';
import './token-cleanup.processor.ts';
import './auction.processor.ts';
import { registerRepeatableJobs } from './scheduler.ts';

export const initWorkers = async () => {
  await registerRepeatableJobs();
  // ...
};
```

`initWorkers()` is called once from `main.ts`, after `initSocketIO(server)`.

## `email-queue`

Worker: [`email.processor.ts`](../../src/app/common/jobs/email.processor.ts), concurrency 5.

Job payload:

```ts
{ to: string, toName?: string, subject: string, htmlContent: string }
```

The processor calls `sendTransactionalEmail` (Brevo — see [docs/services/brevo.md](./brevo.md)). Producers:

* Auth module — OTP verification/reset emails.
* Payments module — `payment-invoice-buyer` and `payment-proceeds-seller`, enqueued with `priority: 1` after a payment settles (see [docs/services/payments.md](./payments.md)).

Retry policy: 3 attempts, exponential backoff starting at 5s.

## `auction-queue`

Worker: [`auction.processor.ts`](../../src/app/common/jobs/auction.processor.ts), concurrency 5. Two job names:

```ts
// src/app/common/jobs/auction.processor.ts
if (job.name === 'start-auction') {
  await AuctionsService.activateAuction(auctionId);
  getIO().of('/auction').to(`auction:${auctionId}`).emit('auction:started', {
    auctionId, status: 'active', startTime, endTime,
  });
}

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
        .emit('notification:new', { type: 'auction_won', auctionId, /* ... */ });
    }
  }
}
```

Jobs are enqueued by `AuctionsService.scheduleTransitions(auctionId, startTime, endTime)`, which runs when an admin approves a pending auction (`PATCH /auctions/admin/:id/review`). Both jobs are **delayed** (BullMQ `delay` option, computed from `startTime`/`endTime`) rather than polled, and use deterministic job IDs:

```ts
jobId: `start-auction-${auctionId}`
jobId: `end-auction-${auctionId}`
```

This makes re-scheduling idempotent — enqueuing the same `jobId` twice doesn't duplicate the job — and lets `cancelScheduledTransitions` remove a pending job by id (e.g. if an auction is later deleted). Retry policy: 3 attempts, exponential backoff starting at 3s.

`end-auction` is the job that actually computes the auction winner (`prisma.liveBid.findFirst({ orderBy: { amount: 'desc' } })`) and writes `EndedAuction`/`UserStats`/`UserActivity`/`Notification`/`AutoBid.status` inside one transaction — see the [root README's Background Jobs section](../../README.md#️-background-jobs-bullmq) and [docs/api-reference.md#auctions](../api-reference.md#auctions) for the full auction lifecycle. Note that **`Payment`/`Transaction` rows are not touched here** — money only moves later, in the payments module, once the winning buyer completes checkout.

## `token-cleanup-queue`

Worker: [`token-cleanup.processor.ts`](../../src/app/common/jobs/token-cleanup.processor.ts), concurrency 1. Deletes `UserToken` rows that are either:

* expired (`expiresAt < now`), or
* stale refresh tokens (`tokenType = 'refresh' AND lastUsedAt < now - 7 days`)

It is never enqueued ad hoc — the only producer is the repeatable job below.

### The daily cron

[`scheduler.ts`](../../src/app/common/jobs/scheduler.ts):

```ts
export const registerRepeatableJobs = async () => {
  await tokenCleanupQueue.add(
    'cleanup-stale-tokens',
    {},
    { repeat: { pattern: '0 3 * * *' }, jobId: 'cleanup-stale-tokens' },
  );
};
```

Runs **daily at 3:00 AM server time**. The fixed `jobId` means calling `registerRepeatableJobs()` again on every deploy/restart doesn't create duplicate repeatable jobs.

## Operational notes

* All three queues depend on Redis being reachable — see [docs/services/redis.md](./redis.md).
* Failed jobs are retained for 24h (`removeOnFail: { age: 86400 }`) for inspection; completed jobs are pruned after 1h or 1000 entries, whichever comes first.
* There's no BullMQ dashboard (e.g. Bull Board) wired into the app — job inspection today means querying Redis directly or adding one.
