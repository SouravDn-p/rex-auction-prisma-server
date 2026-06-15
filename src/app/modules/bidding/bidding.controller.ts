import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../common/interceptors/response.util.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { BiddingService } from "./bidding.service.ts";

export class BiddingController {
  async placeBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const { auctionId, amount } = req.body;
      const result = await BiddingService.placeBid(auctionId, user.userId, amount);
      sendSuccess(res, HTTP_STATUS.OK, "Bid placed successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async setAutoBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const { auctionId, maxBid, incrementStep } = req.body;
      const result = await BiddingService.setAutoBid(auctionId, user.userId, maxBid, incrementStep);
      sendSuccess(res, HTTP_STATUS.OK, "Auto-bid configured successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async cancelAutoBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auctionId = Number(req.params.auctionId);
      await BiddingService.cancelAutoBid(auctionId, user.userId);
      sendSuccess(res, HTTP_STATUS.OK, "Auto-bid cancelled successfully");
    } catch (error) {
      next(error);
    }
  }

  async getMyAutoBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auctionId = Number(req.params.auctionId);
      const autoBid = await BiddingService.getUserAutoBid(auctionId, user.userId);
      sendSuccess(res, HTTP_STATUS.OK, "Auto-bid retrieved", { autoBid });
    } catch (error) {
      next(error);
    }
  }
}