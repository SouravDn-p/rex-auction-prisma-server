import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { ENV } from '../env.config.ts';
import { logger } from '../../app/common/utils/logger.util.ts';

declare global {
  // Prevents multiple instances during hot reload in dev
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
} 

const createPrismaClient = (): PrismaClient => {
  const pool = new pg.Pool({
    connectionString: ENV.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ENV.IS_PRODUCTION
      ? ['error']
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
    errorFormat: ENV.IS_PRODUCTION ? 'minimal' : 'pretty',
  });
};

// Reuse global instance in development (Next.js-style pattern — works in any Node.js app)
export const prisma: PrismaClient = global.__prisma ?? createPrismaClient();

if (!ENV.IS_PRODUCTION) {
  global.__prisma = prisma;

  // Log slow/all queries in development
  (prisma as any).$on('query', (e: any) => {
    logger.debug(`Prisma Query: ${e.query} | Duration: ${e.duration}ms`);
  });
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL (NeonDB) connected via Prisma');
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
};