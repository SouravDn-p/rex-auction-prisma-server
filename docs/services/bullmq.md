# BullMQ

BullMQ powers the background job queues used by the backend.

## Queues

The app defines these queues:

* `email-queue`
* `token-cleanup-queue`
* `auction-queue`

## Flow

1. A service enqueues a job.
2. BullMQ stores the job in Redis.
3. A worker consumes the job asynchronously.
4. Retries and backoff are handled by queue configuration.

## Code Snippet

```ts
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

## Operational Notes

* Email jobs use retries with exponential backoff.
* Token cleanup jobs can remove stale sessions and expired auth records.
* Queue connectivity depends on Redis being available.
