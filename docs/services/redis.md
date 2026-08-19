# Redis

Redis is used for short-lived auth cache data and as the shared connection layer for BullMQ queues.

## Environment Variables

```ini
REDIS_URL=redis://localhost:6379
```

## Flow

1. The auth middleware checks Redis for a cached user record.
2. On cache miss, Prisma loads the user from PostgreSQL.
3. The user is cached again with a short TTL.
4. BullMQ uses the same Redis instance for queue coordination.

## Code Snippet

```ts
export const redisConnection = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error('Redis error:', err));
```

## Auth Cache

The auth middleware caches a lightweight user object:

* `id`
* `email`
* `role`
* `isActive`

This keeps repeated protected-route checks fast without turning Redis into the source of truth.

## Session Support

Redis is not the canonical session store for refresh tokens. Refresh-token sessions are tracked in PostgreSQL, while Redis is used for cache acceleration and queue infrastructure.
