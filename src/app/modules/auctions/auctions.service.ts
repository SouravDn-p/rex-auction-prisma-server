import { prisma } from "../../../config/db/database.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import { auctionQueue } from "../../../config/bull/queue.config.ts";
import { redisConnection } from "../../../config/redis/redis.config.ts";
import type {
  CreateAuctionDto,
  UpdateAuctionDto,
  AdminReviewAuctionDto,
  ListAuctionsQuery,
} from "./interfaces/auctions.interface.ts";
import { AuctionStatus, PaymentStatus, DeliveryStatus, ReactionType } from "@prisma/client";

const CURRENT_BID_KEY = (auctionId: number) => `auction:${auctionId}:currentBid`;

export class AuctionsService {
  // ─────────────────────────────────────────────────────────
  // CREATE — seller creates, status = pending (admin must approve)
  // ─────────────────────────────────────────────────────────
  static async createAuction(sellerId: number, dto: CreateAuctionDto) {
    const auction = await prisma.$transaction(async (tx) => {
      const a = await tx.auction.create({
        data: {
          title: dto.title,
          description: dto.description,
          itemCondition: dto.itemCondition,
          itemYear: dto.itemYear,
          itemReference: dto.itemReference,
          itemValuation: dto.itemValuation,
          history: dto.history,
          images: dto.images,
          category: dto.category ?? null,
          startingPrice: dto.startingPrice,
          currentBid: 0,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          status: "pending",
          sellerId,
          notes: dto.notes ?? null,
        },
      });

      await tx.userActivity.create({
        data: {
          userId: sellerId,
          activityType: "auction_created",
          description: `Created auction "${a.title}" (pending review)`,
          metadata: { auctionId: a.id },
        },
      });

      return a;
    });

    return auction;
  }

  // ─────────────────────────────────────────────────────────
  // UPDATE — only while pending or upcoming, only by owner
  // ─────────────────────────────────────────────────────────
  static async updateAuction(sellerId: number, auctionId: number, dto: UpdateAuctionDto) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) {
      throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    if (auction.sellerId !== sellerId) {
      throw new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }
    if (!["pending", "upcoming"].includes(auction.status)) {
      throw new AppError(MESSAGES.AUCTION.NOT_EDITABLE, HTTP_STATUS.BAD_REQUEST);
    }

    const data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);

    // If editing after approval, send back to pending for re-review
    if (auction.status === "upcoming") {
      data.status = "pending";
      await AuctionsService.cancelScheduledTransitions(auctionId);
    }

    const updated = await prisma.auction.update({
      where: { id: auctionId },
      data,
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────
  // DELETE — only while pending
  // ─────────────────────────────────────────────────────────
  static async deleteAuction(sellerId: number, auctionId: number) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) {
      throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    if (auction.sellerId !== sellerId) {
      throw new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }
    if (auction.status !== "pending") {
      throw new AppError(MESSAGES.AUCTION.NOT_EDITABLE, HTTP_STATUS.BAD_REQUEST);
    }

    await prisma.auction.delete({ where: { id: auctionId } });
  }

  // ─────────────────────────────────────────────────────────
  // ADMIN: approve (pending -> upcoming, schedules transitions)
  //        or reject (pending -> cancelled)
  // ─────────────────────────────────────────────────────────
  static async adminReviewAuction(auctionId: number, dto: AdminReviewAuctionDto) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) {
      throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    if (auction.status !== "pending") {
      throw new AppError(MESSAGES.AUCTION.NOT_PENDING, HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: dto.status,
        notes: dto.notes ?? auction.notes,
      },
    });

    if (dto.status === "upcoming") {
      await AuctionsService.scheduleTransitions(updated.id, updated.startTime, updated.endTime);
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────
  // Schedule BullMQ delayed jobs for start/end transitions
  // ─────────────────────────────────────────────────────────
  static async scheduleTransitions(auctionId: number, startTime: Date, endTime: Date) {
    const now = Date.now();
    const startDelay = Math.max(0, startTime.getTime() - now);
    const endDelay = Math.max(0, endTime.getTime() - now);

    await auctionQueue.add(
      "start-auction",
      { auctionId },
      { delay: startDelay, jobId: `start-auction-${auctionId}` }
    );

    await auctionQueue.add(
      "end-auction",
      { auctionId },
      { delay: endDelay, jobId: `end-auction-${auctionId}` }
    );
  }

  static async cancelScheduledTransitions(auctionId: number) {
    const startJob = await auctionQueue.getJob(`start-auction-${auctionId}`);
    if (startJob) await startJob.remove();

    const endJob = await auctionQueue.getJob(`end-auction-${auctionId}`);
    if (endJob) await endJob.remove();
  }

  // ─────────────────────────────────────────────────────────
  // FSM: upcoming -> active (called by BullMQ worker)
  // ─────────────────────────────────────────────────────────
  static async activateAuction(auctionId: number) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction || auction.status !== "upcoming") return null;

    const updated = await prisma.auction.update({
      where: { id: auctionId },
      data: { status: "active" },
    });

    // Initialize Redis current-bid snapshot
    await redisConnection.set(CURRENT_BID_KEY(auctionId), updated.currentBid.toString());

    return updated;
  }

  // ─────────────────────────────────────────────────────────
  // FSM: active -> ended (called by BullMQ worker)
  // Creates EndedAuction record, determines winner
  // ─────────────────────────────────────────────────────────
  static async endAuction(auctionId: number) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction || auction.status !== "active") return null;

    // Find the highest bid (winner)
    const topBid = await prisma.liveBid.findFirst({
      where: { auctionId },
      orderBy: { amount: "desc" },
    });

    const result = await prisma.$transaction(async (tx) => {
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: { status: topBid ? "ended" : "ended", currentBid: topBid?.amount ?? auction.currentBid },
      });

      const ended = await tx.endedAuction.create({
        data: {
          originalAuctionId: auctionId,
          winnerId: topBid?.userId ?? null,
          finalPrice: topBid?.amount ?? auction.startingPrice,
          deliveryStatus: DeliveryStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      if (topBid?.userId) {
        await tx.userStats.update({
          where: { userId: topBid.userId },
          data: {
            auctionsWon: { increment: 1 },
            activeBids: { decrement: 1 },
          },
        });

        await tx.userActivity.create({
          data: {
            userId: topBid.userId,
            activityType: "auction_won",
            description: `Won auction "${auction.title}" with a bid of ${topBid.amount}`,
            metadata: { auctionId, finalPrice: topBid.amount },
          },
        });

        await tx.notification.create({
          data: {
            recipientId: topBid.userId,
            title: "You won the auction!",
            message: `Congratulations! You won "${auction.title}" for ${topBid.amount}. Please proceed to payment.`,
            type: "auction_won",
            relatedAuctionId: auctionId,
          },
        });
      }

      // Notify seller
      await tx.notification.create({
        data: {
          recipientId: auction.sellerId,
          title: "Your auction has ended",
          message: topBid
            ? `Your auction "${auction.title}" sold for ${topBid.amount}.`
            : `Your auction "${auction.title}" ended with no bids.`,
          type: "auction_ended",
          relatedAuctionId: auctionId,
        },
      });

      // Reconcile all active auto-bids -> close them out
      const activeAutoBids = await tx.autoBid.findMany({
        where: { auctionId, status: "active" },
      });

      for (const ab of activeAutoBids) {
        await tx.autoBid.update({
          where: { id: ab.id },
          data: { status: ab.userId === topBid?.userId ? "won" : "outbid_exceeded" },
        });
      }

      return { updatedAuction, ended, topBid };
    });

    // Cleanup Redis state for this auction
    await redisConnection.del(
      CURRENT_BID_KEY(auctionId),
      `auction:${auctionId}:currentBidderId`,
      `auction:${auctionId}:autobids`
    );

    return result;
  }

  // ─────────────────────────────────────────────────────────
  // LIST (public, with filters)
  // ─────────────────────────────────────────────────────────
  static async listAuctions(query: ListAuctionsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          seller: { select: { id: true, name: true, photo: true } },
          _count: { select: { liveBids: true, watchlists: true, reactions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ]);

    return { auctions, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────
  // GET ONE (with full detail)
  // ─────────────────────────────────────────────────────────
  static async getAuctionById(auctionId: number) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: { select: { id: true, name: true, photo: true, email: true } },
        liveBids: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { id: true, name: true, photo: true } } },
        },
        endedAuction: true,
        _count: { select: { watchlists: true, reactions: true } },
      },
    });

    if (!auction) {
      throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return auction;
  }

  // ─────────────────────────────────────────────────────────
  // ADMIN: list pending auctions
  // ─────────────────────────────────────────────────────────
  static async adminListPending(limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where: { status: "pending" },
        include: { seller: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.auction.count({ where: { status: "pending" } }),
    ]);

    return { auctions, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────
  // SELLER: own auctions (dashboard)
  // ─────────────────────────────────────────────────────────
  static async getSellerAuctions(sellerId: number, status?: AuctionStatus, limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    const where: any = { sellerId };
    if (status) where.status = status;

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: { _count: { select: { liveBids: true, watchlists: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ]);

    return { auctions, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────
  // REACTIONS
  // ─────────────────────────────────────────────────────────
  static async addReaction(userId: number, auctionId: number, reaction: ReactionType) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) {
      throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return prisma.auctionReaction.upsert({
      where: { auctionId_userId: { auctionId, userId } },
      update: { reaction },
      create: { auctionId, userId, reaction },
    });
  }

  static async removeReaction(userId: number, auctionId: number) {
    await prisma.auctionReaction.deleteMany({
      where: { auctionId, userId },
    });
  }
}