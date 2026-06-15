import type { Server as SocketIOServer, Socket } from "socket.io";
import { socketAuthMiddleware } from "./socket-auth.middleware.ts";

import { prisma } from "../../config/db/database.config.ts";
import { logger } from "../../app/common/utils/logger.util.ts";
import { BiddingService } from "../../app/modules/bidding/bidding.service.ts";
import { placeBidDtoSchema, setAutoBidDtoSchema } from "../../app/modules/bidding/dto/bidding.dto.ts";

const room = (auctionId: number) => `auction:${auctionId}`;

export const registerAuctionSocket = (io: SocketIOServer) => {
  const nsp = io.of("/auction");

  nsp.use(socketAuthMiddleware);

  nsp.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`Socket connected: user ${userId} on /auction`);

    // ─── Join an auction room ───
    socket.on("auction:join", async (payload: { auctionId: number }, ack?: (res: any) => void) => {
      try {
        const { auctionId } = payload;
        if (!auctionId) throw new Error("auctionId is required");

        await socket.join(room(auctionId));

        const state = await BiddingService.getAuctionLiveState(auctionId);
        const userAutoBid = await BiddingService.getUserAutoBid(auctionId, userId);

        ack?.({ success: true, data: { ...state, userAutoBid } });
      } catch (error: any) {
        ack?.({ success: false, message: error.message });
      }
    });

    // ─── Leave an auction room ───
    socket.on("auction:leave", async (payload: { auctionId: number }) => {
      if (payload?.auctionId) {
        await socket.leave(room(payload.auctionId));
      }
    });

    // ─── Place a manual bid ───
    socket.on("bid:place", async (payload: { auctionId: number; amount: number }, ack?: (res: any) => void) => {
      try {
        const { error, value } = placeBidDtoSchema.validate(payload);
        if (error) throw new Error(error.details[0]!.message);

        const result = await BiddingService.placeBid(value.auctionId, userId, value.amount);

        // Broadcast final state to everyone in the room
        nsp.to(room(value.auctionId)).emit("bid:update", {
          auctionId: value.auctionId,
          currentBid: result.finalAmount,
          currentBidderId: result.finalBidderId,
          currentBidderName: result.finalBidderName,
          isAutoBid: result.isAutoBid,
          timestamp: new Date().toISOString(),
        });

        ack?.({ success: true, data: result });
      } catch (error: any) {
        ack?.({ success: false, message: error.message });
        socket.emit("bid:error", { message: error.message });
      }
    });

    // ─── Set / update auto-bid ───
    socket.on(
      "autobid:set",
      async (payload: { auctionId: number; maxBid: number; incrementStep: number }, ack?: (res: any) => void) => {
        try {
          const { error, value } = setAutoBidDtoSchema.validate(payload);
          if (error) throw new Error(error.details[0]!.message);

          const { autoBid, resolution } = await BiddingService.setAutoBid(
            value.auctionId,
            userId,
            value.maxBid,
            value.incrementStep
          );

          // If the new auto-bid immediately changed the auction leader, broadcast it
          if (resolution && resolution.bidHistory.length > 0) {
            nsp.to(room(value.auctionId)).emit("bid:update", {
              auctionId: value.auctionId,
              currentBid: resolution.finalAmount,
              currentBidderId: resolution.finalBidderId,
              currentBidderName: resolution.finalBidderName,
              isAutoBid: true,
              timestamp: new Date().toISOString(),
            });
          }

          ack?.({ success: true, data: { autoBid, resolution } });
        } catch (error: any) {
          ack?.({ success: false, message: error.message });
        }
      }
    );

    // ─── Cancel auto-bid ───
    socket.on("autobid:cancel", async (payload: { auctionId: number }, ack?: (res: any) => void) => {
      try {
        const { auctionId } = payload;
        if (!auctionId) throw new Error("auctionId is required");

        await BiddingService.cancelAutoBid(auctionId, userId);
        ack?.({ success: true });
      } catch (error: any) {
        ack?.({ success: false, message: error.message });
      }
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: user ${userId} from /auction`);
    });
  });
};