import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { logger } from '../../app/common/utils/logger.util.ts';
import { ENV } from '../env.config.ts';

export const bullMqConnection: ConnectionOptions = {
  url: ENV.REDIS_URL,
  maxRetriesPerRequest: null,
};

export const redisConnection = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error('Redis error:', err));
