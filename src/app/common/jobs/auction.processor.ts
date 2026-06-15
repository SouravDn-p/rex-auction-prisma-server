import { Worker, type Job } from 'bullmq';
import { bullMqConnection } from '../../../config/redis/redis.config.ts';
import { QUEUE_NAMES } from '../../../config/bull/queue.config.ts';
import { logger } from '../utils/logger.util.ts';
import { AuctionsService } from '../../modules/auctions/auctions.service.ts';
import { getIO } from '../../../services/sockets/index.ts';

export const auctionWorker = new Worker(
  QUEUE_NAMES.AUCTION,
  async (job: Job) => {
    const { auctionId } = job.data;

    if (job.name === 'start-auction') {
      const auction = await AuctionsService.activateAuction(auctionId);
      if (auction) {
        getIO().of('/auction').to(`auction:${auctionId}`).emit('auction:started', {
          auctionId,
          status: 'active',
          startTime: auction.startTime,
          endTime: auction.endTime,
        });
        logger.info(`Auction ${auctionId} activated`);
      }
    }

    if (job.name === 'end-auction') {
      const result = await AuctionsService.endAuction(auctionId);
      if (result) {
        getIO().of('/auction').to(`auction:${auctionId}`).emit('auction:ended', {
          auctionId,
          status: 'ended',
          winnerId: result.topBid?.userId ?? null,
          finalPrice: result.ended.finalPrice,
        });

        // Notify winner via /notifications namespace
        if (result.topBid?.userId) {
          getIO()
            .of('/notifications')
            .to(`user:${result.topBid.userId}`)
            .emit('notification:new', {
              type: 'auction_won',
              auctionId,
              message: `You won the auction for ${result.ended.finalPrice}!`,
            });
        }

        logger.info(`Auction ${auctionId} ended`);
      }
    }
  },
  { connection: bullMqConnection, concurrency: 5 }
);

auctionWorker.on('failed', (job, err) => {
  logger.error(`Auction job ${job?.id} (${job?.name}) failed:`, err.message);
});