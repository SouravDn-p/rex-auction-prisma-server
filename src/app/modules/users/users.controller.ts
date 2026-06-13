import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../common/interceptors/response.util.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { UsersService } from "./users.service.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import { SellerRequestStatus, UserRole } from "@prisma/client";

export class UsersController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const authUser = req.user;
      const user = await UsersService.getUserProfile(authUser.userId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.USER.FETCHED, { user });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const authUser = req.user;
      const user = await UsersService.updateUserProfile(authUser.userId, req.body);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.USER.UPDATED, { user });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const authUser = req.user;
      const stats = await UsersService.getUserStats(authUser.userId);
      sendSuccess(res, HTTP_STATUS.OK, "User statistics retrieved successfully", { stats });
    } catch (error) {
      next(error);
    }
  }

  async getActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const authUser = req.user;
      const result = await UsersService.getUserActivities(authUser.userId, limit, page);
      sendSuccess(res, HTTP_STATUS.OK, "User activities retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async getWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const authUser = req.user;
      const watchlist = await UsersService.getWatchlist(authUser.userId);
      sendSuccess(res, HTTP_STATUS.OK, "Watchlist items retrieved successfully", { watchlist });
    } catch (error) {
      next(error);
    }
  }

  async addToWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const auctionId = parseInt(req.params.auctionId as string) || parseInt(req.body.auctionId as string);
      if (!auctionId) {
        throw new AppError("Valid Auction ID is required", HTTP_STATUS.BAD_REQUEST);
      }
      const authUser = req.user;
      const item = await UsersService.addToWatchlist(authUser.userId, auctionId);
      sendSuccess(res, HTTP_STATUS.CREATED, "Added to watchlist successfully", { item });
    } catch (error) {
      next(error);
    }
  }

  async removeFromWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const auctionId = parseInt(req.params.auctionId as string);
      if (!auctionId) {
        throw new AppError("Valid Auction ID is required", HTTP_STATUS.BAD_REQUEST);
      }
      const authUser = req.user;
      await UsersService.removeFromWatchlist(authUser.userId, auctionId);
      sendSuccess(res, HTTP_STATUS.OK, "Removed from watchlist successfully");
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const authUser = req.user;
      const transactions = await UsersService.getTransactions(authUser.userId);
      sendSuccess(res, HTTP_STATUS.OK, "User transactions retrieved successfully", { transactions });
    } catch (error) {
      next(error);
    }
  }

  async submitSellerRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const authUser = req.user;
      const request = await UsersService.submitSellerRequest(authUser.userId, req.body);
      sendSuccess(res, HTTP_STATUS.CREATED, "Seller request submitted successfully", { request });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ADMIN: Review seller request
   */
  async adminReviewSellerRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const requestId = parseInt(req.params.requestId as string);
      const { status } = req.body;
      if (!requestId) {
        throw new AppError("Valid Seller Request ID is required in route params", HTTP_STATUS.BAD_REQUEST);
      }
      const authUser = req.user;
      const request = await UsersService.adminReviewSellerRequest(authUser.userId, requestId, status as SellerRequestStatus);
      sendSuccess(res, HTTP_STATUS.OK, `Seller request successfully ${status}`, { request });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ADMIN: Get all seller requests
   */
  async adminGetAllSellerRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const status = req.query.status as SellerRequestStatus | undefined;

      if (status && !Object.values(SellerRequestStatus).includes(status)) {
        throw new AppError("Invalid status filter", HTTP_STATUS.BAD_REQUEST);
      }

      const result = await UsersService.adminGetAllSellerRequests(limit, page, status);
      sendSuccess(res, HTTP_STATUS.OK, "Seller requests retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ADMIN: Get all users (supports search + role filter)
   */
  async adminGetAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const search = req.query.search as string | undefined;
      const role = req.query.role as UserRole | undefined;

      if (role && !Object.values(UserRole).includes(role)) {
        throw new AppError("Invalid role filter", HTTP_STATUS.BAD_REQUEST);
      }

      const result = await UsersService.adminGetAllUsers(limit, page, search, role);
      sendSuccess(res, HTTP_STATUS.OK, "All users retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ADMIN: Update user status (Deactivate / Activate)
   */
  async adminUpdateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
      }
      const targetUserId = parseInt(req.params.userId as string);
      const { isActive } = req.body;
      if (!targetUserId) {
        throw new AppError("Valid User ID is required in route params", HTTP_STATUS.BAD_REQUEST);
      }
      const authUser = req.user;
      const user = await UsersService.adminUpdateUserStatus(authUser.userId, targetUserId, isActive);
      const message = isActive ? "User activated successfully" : "User deactivated successfully";
      sendSuccess(res, HTTP_STATUS.OK, message, { user });
    } catch (error) {
      next(error);
    }
  }
}