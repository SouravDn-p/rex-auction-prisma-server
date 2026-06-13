
import { tokenCleanupQueue } from '../../../config/bull/queue.config.ts';
import { logger } from '../utils/logger.util.ts';

export const registerRepeatableJobs = async (): Promise<void> => {
  // Daily at 3 AM
  await tokenCleanupQueue.add(
    'cleanup-stale-tokens',
    {},
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'cleanup-stale-tokens', // idempotent — won't duplicate
    }
  );

  logger.info('Repeatable jobs registered');
};