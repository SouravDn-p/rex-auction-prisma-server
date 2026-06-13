import './email.processor.ts';
import './token-cleanup.processor.ts';
import { registerRepeatableJobs } from './scheduler.ts';
import { logger } from '../utils/logger.util.ts';

export const initWorkers = async (): Promise<void> => {
  await registerRepeatableJobs();
  logger.info('Background workers initialized');
};