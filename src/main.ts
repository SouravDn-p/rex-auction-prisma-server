import { CreateApp } from './app.ts';
import { logger } from './app/common/utils/logger.util.ts';
import { connectDatabase, disconnectDatabase } from './config/db/database.config.ts';
import { ENV } from './config/env.config.ts';

const startServer = async (): Promise<void> => {
  await connectDatabase();

  const app = CreateApp();
  const server = app.listen(ENV.PORT, () => {
    logger.info(`Server running in ${ENV.NODE_ENV} mode on port http://localhost:${ENV.PORT}`);
    logger.info("Swagger UI available at: http://localhost:5000/api/docs");
  });
  

  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase(); // close Prisma connection pool
      logger.info('Server and database connections closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', async (reason) => {
    logger.error('Unhandled Rejection:', reason);
    await disconnectDatabase();
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

startServer();