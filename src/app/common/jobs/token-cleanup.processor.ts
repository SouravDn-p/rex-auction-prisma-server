import { Worker, type Job } from 'bullmq';
import { logger } from '../utils/logger.util.ts';
import { prisma } from '../../../config/db/database.config.ts';
import { QUEUE_NAMES } from '../../../config/bull/queue.config.ts';
import { bullMqConnection } from '../../../config/redis/redis.config.ts';

export const tokenCleanupWorker = new Worker(
  QUEUE_NAMES.TOKEN_CLEANUP,
  async (_job: Job) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await prisma.userToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { tokenType: 'refresh', lastUsedAt: { lt: sevenDaysAgo } },
        ],
      },
    });

    logger.info(`Token cleanup: removed ${result.count} stale tokens`);
    return { removed: result.count };
  },
  { connection: bullMqConnection, concurrency: 1 }
);

tokenCleanupWorker.on('failed', (job, err) => {
  logger.error(`Token cleanup job ${job?.id} failed:`, err.message);
});