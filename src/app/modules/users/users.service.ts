import { prisma } from "../../../config/db/database.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import type {
  UpdateUserDto,
  SubmitSellerRequestDto,
} from "./interfaces/users.interface.ts";
import { SellerRequestStatus } from "@prisma/client";

export class UsersService {
  /**
   * Get user profile by ID
   */
  static async getUserProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Update user profile information
   */
  static async updateUserProfile(userId: number, dto: UpdateUserDto) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: dto,
      });

      await tx.userActivity.create({
        data: {
          userId,
          activityType: "profile_updated",
          description: "Updated profile details",
          metadata: dto as any,
        },
      });

      return u;
    });

    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  /**
   * Get or initialize user statistics
   */
  static async getUserStats(userId: number) {
    let stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) {
      stats = await prisma.userStats.create({
        data: {
          userId,
          accountBalance: 0,
          auctionsWon: 0,
          activeBids: 0,
          totalSpent: 0,
        },
      });
    }
    return stats;
  }

  /**
   * Get activity history of a user
   */
  static async getUserActivities(userId: number, limit = 50, page = 1) {
    const skip = (page - 1) * limit;
    const [activities, total] = await Promise.all([
      prisma.userActivity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.userActivity.count({ where: { userId } }),
    ]);

    return { activities, total, page, limit };
  }

  /**
   * Get user's watchlist with auction and seller details
   */
  static async getWatchlist(userId: number) {
    return prisma.watchlist.findMany({
      where: { userId },
      include: {
        auction: {
          include: {
            seller: {
              select: {
                id: true,
                name: true,
                email: true,
                photo: true,
              },
            },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });
  }

  /**
   * Add an auction to the user's watchlist
   */
  static async addToWatchlist(userId: number, auctionId: number) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) {
      throw new AppError("Auction not found", HTTP_STATUS.NOT_FOUND);
    }

    const existing = await prisma.watchlist.findUnique({
      where: { userId_auctionId: { userId, auctionId } },
    });
    if (existing) {
      return existing;
    }

    const watchlist = await prisma.$transaction(async (tx) => {
      const w = await tx.watchlist.create({
        data: { userId, auctionId },
      });

      await tx.userActivity.create({
        data: {
          userId,
          activityType: "watched_auction",
          description: `Added auction "${auction.title}" to watchlist`,
          metadata: { auctionId },
        },
      });

      return w;
    });

    return watchlist;
  }

  /**
   * Remove an auction from the user's watchlist
   */
  static async removeFromWatchlist(userId: number, auctionId: number) {
    const existing = await prisma.watchlist.findUnique({
      where: { userId_auctionId: { userId, auctionId } },
    });
    if (!existing) {
      throw new AppError("Watchlist item not found", HTTP_STATUS.NOT_FOUND);
    }

    await prisma.watchlist.delete({
      where: { id: existing.id },
    });
  }

  /**
   * Fetch transaction list for a user
   */
  static async getTransactions(userId: number) {
    return prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Submit a new request to become a seller
   */
  static async submitSellerRequest(userId: number, dto: SubmitSellerRequestDto) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (user.role === "SELLER" || user.role === "ADMIN") {
      throw new AppError("User is already a seller or admin", HTTP_STATUS.BAD_REQUEST);
    }

    const existingPending = await prisma.sellerRequest.findFirst({
      where: { userId, status: "pending" },
    });
    if (existingPending) {
      throw new AppError("You already have a pending seller request", HTTP_STATUS.BAD_REQUEST);
    }

    const request = await prisma.$transaction(async (tx) => {
      const r = await tx.sellerRequest.create({
        data: {
          userId,
          businessName: dto.businessName,
          contactPhone: dto.contactPhone,
          address: dto.address,
          taxId: dto.taxId,
          additionalNotes: dto.additionalNotes ?? null,
        },
      });

      await tx.userActivity.create({
        data: {
          userId,
          activityType: "seller_request_submitted",
          description: `Submitted a request to become a seller for business "${dto.businessName}"`,
          metadata: { requestId: r.id },
        },
      });

      return r;
    });

    return request;
  }

  /**
   * ADMIN: Review and approve/reject a seller request
   */
  static async adminReviewSellerRequest(
    adminId: number,
    requestId: number,
    status: SellerRequestStatus
  ) {
    const request = await prisma.sellerRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new AppError("Seller request not found", HTTP_STATUS.NOT_FOUND);
    }

    if (request.status !== "pending") {
      throw new AppError("Request has already been reviewed", HTTP_STATUS.BAD_REQUEST);
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const r = await tx.sellerRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });

      if (status === "approved") {
        await tx.user.update({
          where: { id: request.userId },
          data: { role: "SELLER" },
        });

        await tx.userActivity.create({
          data: {
            userId: request.userId,
            activityType: "profile_updated",
            description: "Role upgraded to SELLER",
            metadata: { requestId },
          },
        });
      }

      return r;
    });

    return updatedRequest;
  }

  /**
   * ADMIN: Fetch all seller requests with status filter
   */
  static async adminGetAllSellerRequests(limit = 50, page = 1, status?: SellerRequestStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [requests, total] = await Promise.all([
      prisma.sellerRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              photo: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sellerRequest.count({ where }),
    ]);

    return { requests, total, page, limit };
  }

  /**
   * ADMIN: List all users with pagination and search
   */
  static async adminGetAllUsers(limit = 50, page = 1, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          photo: true,
          cover: true,
          location: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  /**
   * ADMIN: Activate or deactivate a user
   */
  static async adminUpdateUserStatus(adminId: number, targetUserId: number, isActive: boolean) {
    if (adminId === targetUserId) {
      throw new AppError("You cannot update your own active status", HTTP_STATUS.BAD_REQUEST);
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return updatedUser;
  }
}
