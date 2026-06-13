import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES } from '../../../config/bull/queue.config.ts';
import { logger } from '../utils/logger.util.ts';
import { bullMqConnection } from '../../../config/redis/redis.config.ts';
import type { EmailJobData } from '../interfaces/email-job.interface.ts';
import { sendTransactionalEmail } from '../utils/mailer.util.ts';

export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job: Job<EmailJobData>) => {
    const { to, toName, subject, htmlContent } = job.data;
    await sendTransactionalEmail({
      to,
      ...(toName ? { toName } : {}),
      subject,
      htmlContent,
    });
    logger.info(`Email sent to ${to} | subject: ${subject}`);
  },
  {
    connection: bullMqConnection,
    concurrency: 5,
  }
);

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job ${job?.id} failed:`, err.message);
});

emailWorker.on('completed', (job) => {
  logger.info(`Email job ${job.id} completed`);
});