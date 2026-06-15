import { prisma } from "../../../config/db/database.config.ts";
import { redisConnection } from "../../../config/redis/redis.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import type { BidResolutionResult } from "./interfaces/bidding.interface.ts";
import { Decimal } from "decimal.js";

const CURRENT_BID_KEY = (auctionId: number) => `auction:${auctionId}:currentBid`;
const CURRENT_BIDDER_KEY = (auctionId: number) => `auction:${auctionId}:currentBidderId`;
const AUTOBIDS_KEY = (auctionId: number) => `auction:${auctionId}:autobids`;
const LOCK_KEY = (auctionId: number) => `auction:${auctionId}:lock`;

interface AutoBidEntry {
  userId: number;
  maxBid: string;
  incrementStep: string;
}

export class BiddingService {
  // ─────────────────────────────────────────────────────────
  // Acquire a short-lived lock to serialize bid processing per auction
  // ─────────────────────────────────────────────────────────
  private static async acquireLock(auctionId: number, ttlMs = 5000): Promise<boolean> {
    const result = await redisConnection.set(LOCK_KEY(auctionId), "1", "PX", ttlMs, "NX");
    return result === "OK";
  }

  private static async releaseLock(auctionId: number): Promise<void> {
    await redisConnection.del(LOCK_KEY(auctionId));
  }

  private static async withLock<T>(auctionId: number, fn: () => Promise<T>): Promise<T> {
    let attempts = 0;
    while (attempts < 20) {
      const acquired = await BiddingService.acquireLock(auctionId);
      if (acquired) {
        try {
          return await fn();
        } finally {
          await BiddingService.releaseLock(auctionId);
        }
      }
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
    throw new AppError("System busy, please try again", HTTP_STATUS.TOO_MANY_REQUESTS);
  }

  // ─────────────────────────────────────────────────────────
  // Load all active auto-bids for an auction from Redis (fallback to DB)
  // ─────────────────────────────────────────────────────────
  private static async getAutoBids(auctionId: number): Promise<AutoBidEntry[]> {
    const hash = await redisConnection.hgetall(AUTOBIDS_KEY(auctionId));
    if (Object.keys(hash).length > 0) {
      return Object.entries(hash).map(([userId, val]) => {
        const parsed = JSON.parse(val) as { maxBid: string; incrementStep: string };
        return { userId: Number(userId), maxBid: parsed.maxBid, incrementStep: parsed.incrementStep };
      });
    }

    // Fallback: load from DB and cache into Redis
    const dbAutoBids = await prisma.autoBid.findMany({
      where: { auctionId, status: "active" },
    });

    if (dbAutoBids.length > 0) {
      const pipeline = redisConnection.pipeline();
      for (const ab of dbAutoBids) {
        pipeline.hset(
          AUTOBIDS_KEY(auctionId),
          ab.userId.toString(),
          JSON.stringify({ maxBid: ab.maxBid.toString(), incrementStep: ab.incrementStep.toString() })
        );
      }
      await pipeline.exec();
    }

    return dbAutoBids.map((ab) => ({
      userId: ab.userId,
      maxBid: ab.maxBid.toString(),
      incrementStep: ab.incrementStep.toString(),
    }));
  }

  // ─────────────────────────────────────────────────────────
  // CORE: Place a manual bid and resolve auto-bids
  // ─────────────────────────────────────────────────────────
  static async placeBid(auctionId: number, userId: number, amount: number): Promise<BidResolutionResult> {
    return BiddingService.withLock(auctionId, async () => {
      const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
      if (!auction) throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      if (auction.status !== "active") throw new AppError(MESSAGES.AUCTION.NOT_ACTIVE, HTTP_STATUS.BAD_REQUEST);
      if (auction.sellerId === userId) throw new AppError(MESSAGES.BID.SELLER_CANNOT_BID, HTTP_STATUS.FORBIDDEN);

      const bidAmount = new Decimal(amount);
      const startingPrice = new Decimal(auction.startingPrice.toString());

      // Get current state from Redis (or fallback to DB)
      let currentBidStr = await redisConnection.get(CURRENT_BID_KEY(auctionId));
      let currentBid = currentBidStr ? new Decimal(currentBidStr) : new Decimal(auction.currentBid.toString());
      let currentBidderStr = await redisConnection.get(CURRENT_BIDDER_KEY(auctionId));
      let currentBidderId = currentBidderStr ? Number(currentBidderStr) : null;

      // Validate amount
      if (bidAmount.lt(startingPrice)) {
        throw new AppError(MESSAGES.BID.BELOW_STARTING, HTTP_STATUS.BAD_REQUEST);
      }
      if (currentBid.gt(0) && bidAmount.lte(currentBid)) {
        throw new AppError(MESSAGES.BID.TOO_LOW, HTTP_STATUS.BAD_REQUEST);
      }

      // Check balance
      const stats = await prisma.userStats.findUnique({ where: { userId } });
      if (!stats || new Decimal(stats.accountBalance.toString()).lt(bidAmount)) {
        throw new AppError(MESSAGES.BID.INSUFFICIENT_BALANCE, HTTP_STATUS.BAD_REQUEST);
      }

      // ─── Resolve: start with the manual bid as the leading bid ───
      let leaderId = userId;
      let leaderAmount = bidAmount;
      let leaderIsAutoBid = false;

      const bidHistory: BidResolutionResult["bidHistory"] = [
        { userId, amount: bidAmount.toString(), isAutoBid: false },
      ];

      const autoBids = await BiddingService.getAutoBids(auctionId);

      // Iteratively resolve auto-bid chain
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Candidates: active auto-bids NOT belonging to current leader,
        // where leaderAmount + theirIncrement <= theirMaxBid
        const candidates = autoBids
          .filter((ab) => ab.userId !== leaderId)
          .map((ab) => ({
            ...ab,
            maxBidDec: new Decimal(ab.maxBid),
            incrementDec: new Decimal(ab.incrementStep),
            nextBid: leaderAmount.plus(new Decimal(ab.incrementStep)),
          }))
          .filter((ab) => ab.nextBid.lte(ab.maxBidDec))
          .sort((a, b) => b.maxBidDec.comparedTo(a.maxBidDec)); // highest maxBid wins ties

        const winner = candidates[0];
        if (!winner) break;

        leaderId = winner.userId;
        leaderAmount = winner.nextBid;
        leaderIsAutoBid = true;

        bidHistory.push({ userId: winner.userId, amount: leaderAmount.toString(), isAutoBid: true });
      }

      // ─── Persist final state ───
      const leaderUser = await prisma.user.findUnique({
        where: { id: leaderId },
        select: { id: true, name: true },
      });
      if (!leaderUser) throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

      await prisma.$transaction(async (tx) => {
        // Record the manual bid (always recorded as-is)
        await tx.liveBid.create({
          data: {
            auctionId,
            userId,
            amount: bidAmount,
          },
        });

        // If auto-bid resolution changed the leader, record that too
        if (leaderIsAutoBid) {
          await tx.liveBid.create({
            data: {
              auctionId,
              userId: leaderId,
              amount: leaderAmount,
            },
          });
        }

        await tx.auction.update({
          where: { id: auctionId },
          data: { currentBid: leaderAmount },
        });

        // Update active-bid counters
        if (currentBidderId && currentBidderId !== leaderId) {
          await tx.userStats.updateMany({
            where: { userId: currentBidderId },
            data: { activeBids: { decrement: 1 } },
          });
        }
        if (currentBidderId !== leaderId) {
          await tx.userStats.updateMany({
            where: { userId: leaderId },
            data: { activeBids: { increment: 1 } },
          });
        }

        await tx.userActivity.create({
          data: {
            userId,
            activityType: "bid_placed",
            description: `Placed a bid of ${bidAmount.toString()} on auction "${auction.title}"`,
            metadata: { auctionId, amount: bidAmount.toString() },
          },
        });

        // Notify the previous leader they've been outbid
        if (currentBidderId && currentBidderId !== leaderId) {
          await tx.notification.create({
            data: {
              recipientId: currentBidderId,
              title: "You've been outbid",
              message: `Someone placed a higher bid on "${auction.title}". Current bid: ${leaderAmount.toString()}`,
              type: "outbid",
              relatedAuctionId: auctionId,
              relatedUserId: leaderId,
            },
          });
        }
      });

      // Update Redis snapshot
      await redisConnection.set(CURRENT_BID_KEY(auctionId), leaderAmount.toString());
      await redisConnection.set(CURRENT_BIDDER_KEY(auctionId), leaderId.toString());

      return {
        finalAmount: leaderAmount.toString(),
        finalBidderId: leaderId,
        finalBidderName: leaderUser.name,
        isAutoBid: leaderIsAutoBid,
        bidHistory,
      };
    });
  }

  // ─────────────────────────────────────────────────────────
  // SET AUTO-BID
  // ─────────────────────────────────────────────────────────
  static async setAutoBid(auctionId: number, userId: number, maxBid: number, incrementStep: number) {
    return BiddingService.withLock(auctionId, async () => {
      const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
      if (!auction) throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      if (auction.status !== "active") throw new AppError(MESSAGES.AUCTION.NOT_ACTIVE, HTTP_STATUS.BAD_REQUEST);
      if (auction.sellerId === userId) throw new AppError(MESSAGES.BID.SELLER_CANNOT_BID, HTTP_STATUS.FORBIDDEN);

      const maxBidDec = new Decimal(maxBid);
      const currentBidStr = await redisConnection.get(CURRENT_BID_KEY(auctionId));
      const currentBid = currentBidStr ? new Decimal(currentBidStr) : new Decimal(auction.currentBid.toString());

      if (maxBidDec.lte(currentBid)) {
        throw new AppError(MESSAGES.BID.AUTOBID_MAX_TOO_LOW, HTTP_STATUS.BAD_REQUEST);
      }

      const stats = await prisma.userStats.findUnique({ where: { userId } });
      if (!stats || new Decimal(stats.accountBalance.toString()).lt(maxBidDec)) {
        throw new AppError(MESSAGES.BID.INSUFFICIENT_BALANCE, HTTP_STATUS.BAD_REQUEST);
      }

      // Upsert in DB
      const autoBid = await prisma.autoBid.upsert({
        where: { auctionId_userId: { auctionId, userId } },
        update: { maxBid: maxBidDec, incrementStep, status: "active" },
        create: { auctionId, userId, maxBid: maxBidDec, incrementStep, status: "active" },
      });

      // Sync to Redis
      await redisConnection.hset(
        AUTOBIDS_KEY(auctionId),
        userId.toString(),
        JSON.stringify({ maxBid: maxBidDec.toString(), incrementStep: incrementStep.toString() })
      );

      // If this user isn't currently leading, immediately try to resolve
      // (their auto-bid might already beat the current leader)
      const currentBidderStr = await redisConnection.get(CURRENT_BIDDER_KEY(auctionId));
      const currentBidderId = currentBidderStr ? Number(currentBidderStr) : null;

      let resolution: BidResolutionResult | null = null;

      if (currentBidderId !== userId && currentBid.plus(incrementStep).lte(maxBidDec)) {
        // Trigger resolution as if this user placed currentBid + increment
        // Reuse the same engine by simulating: treat current leader's position
        // as the "manual bid" baseline and resolve from there.
        resolution = await BiddingService.resolveFromCurrentState(auctionId, auction.title);
      }

      return { autoBid, resolution };
    });
  }

  // ─────────────────────────────────────────────────────────
  // Re-resolve auto-bid chain from current Redis state
  // (used when a new auto-bid is set and could immediately outbid the leader)
  // ─────────────────────────────────────────────────────────
  private static async resolveFromCurrentState(auctionId: number, auctionTitle: string): Promise<BidResolutionResult> {
    const currentBidStr = await redisConnection.get(CURRENT_BID_KEY(auctionId));
    const currentBidderStr = await redisConnection.get(CURRENT_BIDDER_KEY(auctionId));

    let leaderAmount = currentBidStr ? new Decimal(currentBidStr) : new Decimal(0);
    let leaderId = currentBidderStr ? Number(currentBidderStr) : 0;
    let leaderIsAutoBid = false;

    const bidHistory: BidResolutionResult["bidHistory"] = [];
    const autoBids = await BiddingService.getAutoBids(auctionId);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidates = autoBids
        .filter((ab) => ab.userId !== leaderId)
        .map((ab) => ({
          ...ab,
          maxBidDec: new Decimal(ab.maxBid),
          nextBid: leaderAmount.plus(new Decimal(ab.incrementStep)),
        }))
        .filter((ab) => ab.nextBid.lte(ab.maxBidDec))
        .sort((a, b) => b.maxBidDec.comparedTo(a.maxBidDec));

      const winner = candidates[0];
      if (!winner) break;

      leaderId = winner.userId;
      leaderAmount = winner.nextBid;
      leaderIsAutoBid = true;

      bidHistory.push({ userId: winner.userId, amount: leaderAmount.toString(), isAutoBid: true });
    }

    if (bidHistory.length === 0) {
      // No change
      const user = await prisma.user.findUnique({ where: { id: leaderId }, select: { name: true } });
      return {
        finalAmount: leaderAmount.toString(),
        finalBidderId: leaderId,
        finalBidderName: user?.name ?? "",
        isAutoBid: false,
        bidHistory: [],
      };
    }

    const prevLeaderId = currentBidderStr ? Number(currentBidderStr) : null;
    const leaderUser = await prisma.user.findUnique({ where: { id: leaderId }, select: { id: true, name: true } });

    await prisma.$transaction(async (tx) => {
      for (const entry of bidHistory) {
        await tx.liveBid.create({
          data: { auctionId, userId: entry.userId, amount: new Decimal(entry.amount) },
        });
      }

      await tx.auction.update({
        where: { id: auctionId },
        data: { currentBid: leaderAmount },
      });

      if (prevLeaderId && prevLeaderId !== leaderId) {
        await tx.userStats.updateMany({
          where: { userId: prevLeaderId },
          data: { activeBids: { decrement: 1 } },
        });
        await tx.userStats.updateMany({
          where: { userId: leaderId },
          data: { activeBids: { increment: 1 } },
        });

        await tx.notification.create({
          data: {
            recipientId: prevLeaderId,
            title: "You've been outbid",
            message: `An auto-bid has outbid you on "${auctionTitle}". Current bid: ${leaderAmount.toString()}`,
            type: "outbid",
            relatedAuctionId: auctionId,
            relatedUserId: leaderId,
          },
        });
      }
    });

    await redisConnection.set(CURRENT_BID_KEY(auctionId), leaderAmount.toString());
    await redisConnection.set(CURRENT_BIDDER_KEY(auctionId), leaderId.toString());

    return {
      finalAmount: leaderAmount.toString(),
      finalBidderId: leaderId,
      finalBidderName: leaderUser?.name ?? "",
      isAutoBid: leaderIsAutoBid,
      bidHistory,
    };
  }

  // ─────────────────────────────────────────────────────────
  // CANCEL AUTO-BID
  // ─────────────────────────────────────────────────────────
  static async cancelAutoBid(auctionId: number, userId: number) {
    const existing = await prisma.autoBid.findUnique({
      where: { auctionId_userId: { auctionId, userId } },
    });
    if (!existing || existing.status !== "active") {
      throw new AppError("No active auto-bid found", HTTP_STATUS.NOT_FOUND);
    }

    await prisma.autoBid.update({
      where: { id: existing.id },
      data: { status: "cancelled" },
    });

    await redisConnection.hdel(AUTOBIDS_KEY(auctionId), userId.toString());
  }

  // ─────────────────────────────────────────────────────────
  // GET CURRENT STATE (for socket join / page load)
  // ─────────────────────────────────────────────────────────
  static async getAuctionLiveState(auctionId: number) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { id: true, currentBid: true, status: true, startTime: true, endTime: true, startingPrice: true },
    });
    if (!auction) throw new AppError(MESSAGES.AUCTION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    const recentBids = await prisma.liveBid.findMany({
      where: { auctionId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { id: true, name: true, photo: true } } },
    });

    return { auction, recentBids };
  }

  // ─────────────────────────────────────────────────────────
  // GET USER'S AUTO-BID for an auction (so client can show current config)
  // ─────────────────────────────────────────────────────────
  static async getUserAutoBid(auctionId: number, userId: number) {
    return prisma.autoBid.findUnique({
      where: { auctionId_userId: { auctionId, userId } },
    });
  }
}