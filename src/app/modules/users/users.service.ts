import { prisma } from "../../../config/db/database.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import { invalidateUserCache } from "../../common/guards/auth.middleware.ts";
import type {
  UpdateUserDto,
  SubmitSellerRequestDto,
} from "./interfaces/users.interface.ts";
import { Prisma, SellerRequestStatus, UserRole } from "@prisma/client";

export class UsersService {
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

  static async updateUserProfile(userId: number, dto: UpdateUserDto) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.photo !== undefined ? { photo: dto.photo || null } : {}),
          ...(dto.cover !== undefined ? { cover: dto.cover || null } : {}),
          ...(dto.location !== undefined ? { location: dto.location || null } : {}),
        },
      });

      await tx.userActivity.create({
        data: {
          userId,
          activityType: "profile_updated",
          description: "Updated profile details",
          metadata: dto as Prisma.InputJsonValue,
        },
      });

      return u;
    });

    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

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

  static async getTransactions(userId: number) {
    return prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

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
   * ADMIN: Review and approve/reject a seller request.
   * On approval, promotes user to SELLER and invalidates their auth cache
   * so the role change takes effect immediately.
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

    if (status === "approved") {
      await invalidateUserCache(request.userId);
    }

    return updatedRequest;
  }

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
   * ADMIN: List all users with pagination, search, and optional role filter
   */
  static async adminGetAllUsers(limit = 50, page = 1, search?: string, role?: UserRole) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
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
   * ADMIN: Activate or deactivate a user.
   * Invalidates the user's auth cache so the status change is enforced
   * on their very next request, not after the 60s cache TTL.
   */
  static async adminUpdateUserStatus(adminId: number, targetUserId: number, isActive: boolean) {
    if (adminId === targetUserId) {
      throw new AppError("You cannot update your own active status", HTTP_STATUS.BAD_REQUEST);
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (user.role === "ADMIN") {
      throw new AppError("Cannot change active status of an admin account", HTTP_STATUS.FORBIDDEN);
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

    await invalidateUserCache(targetUserId);

    // Deactivation: also revoke all sessions so they can't keep using existing access tokens
    if (!isActive) {
      await prisma.userToken.deleteMany({
        where: { userId: targetUserId, tokenType: "refresh" },
      });
    }

    return updatedUser;
  }
}