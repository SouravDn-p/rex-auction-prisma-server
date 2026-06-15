import { Queue } from 'bullmq';
import { bullMqConnection } from '../redis/redis.config.ts';

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

export const tokenCleanupQueue = new Queue(QUEUE_NAMES.TOKEN_CLEANUP, {
  connection: bullMqConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export const auctionQueue = new Queue(QUEUE_NAMES.AUCTION, {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});