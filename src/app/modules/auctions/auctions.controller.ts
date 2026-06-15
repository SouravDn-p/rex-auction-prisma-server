import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../common/interceptors/response.util.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AuctionsService } from "./auctions.service.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import { AuctionStatus } from "@prisma/client";

export class AuctionsController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auction = await AuctionsService.createAuction(user.userId, req.body);
      sendSuccess(res, HTTP_STATUS.CREATED, MESSAGES.AUCTION.CREATED, { auction });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auctionId = Number(req.params.id);
      const auction = await AuctionsService.updateAuction(user.userId, auctionId, req.body);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUCTION.UPDATED, { auction });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auctionId = Number(req.params.id);
      await AuctionsService.deleteAuction(user.userId, auctionId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUCTION.DELETED);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: {
        page?: number;
        limit?: number;
        status?: AuctionStatus;
        category?: string;
        sellerId?: number;
        search?: string;
      } = {};
      if (req.query.page) query.page = Number(req.query.page);
      if (req.query.limit) query.limit = Number(req.query.limit);
      if (req.query.status) query.status = req.query.status as AuctionStatus;
      if (req.query.category) query.category = req.query.category as string;
      if (req.query.sellerId) query.sellerId = Number(req.query.sellerId);
      if (req.query.search) query.search = req.query.search as string;
      const result = await AuctionsService.listAuctions(query);
      sendSuccess(res, HTTP_STATUS.OK, "Auctions retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = Number(req.params.id);
      const auction = await AuctionsService.getAuctionById(auctionId);
      sendSuccess(res, HTTP_STATUS.OK, "Auction retrieved successfully", { auction });
    } catch (error) {
      next(error);
    }
  }

  async sellerAuctions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const status = req.query.status as AuctionStatus | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const result = await AuctionsService.getSellerAuctions(user.userId, status, limit, page);
      sendSuccess(res, HTTP_STATUS.OK, "Seller auctions retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  // ─── ADMIN ───
  async adminListPending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const result = await AuctionsService.adminListPending(limit, page);
      sendSuccess(res, HTTP_STATUS.OK, "Pending auctions retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async adminReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctionId = Number(req.params.id);
      const auction = await AuctionsService.adminReviewAuction(auctionId, req.body);
      const message = req.body.status === "upcoming" ? MESSAGES.AUCTION.APPROVED : MESSAGES.AUCTION.REJECTED;
      sendSuccess(res, HTTP_STATUS.OK, message, { auction });
    } catch (error) {
      next(error);
    }
  }

  // ─── REACTIONS ───
  async addReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auctionId = Number(req.params.id);
      const { reaction } = req.body;
      const result = await AuctionsService.addReaction(user.userId, auctionId, reaction);
      sendSuccess(res, HTTP_STATUS.OK, "Reaction added successfully", { reaction: result });
    } catch (error) {
      next(error);
    }
  }

  async removeReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auctionId = Number(req.params.id);
      await AuctionsService.removeReaction(user.userId, auctionId);
      sendSuccess(res, HTTP_STATUS.OK, "Reaction removed successfully");
    } catch (error) {
      next(error);
    }
  }
}