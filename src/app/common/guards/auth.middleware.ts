import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../exceptions/app-error.exception.ts';
import { HTTP_STATUS } from '../constants/http-status.constants.ts';
import { MESSAGES } from '../constants/messages.constants.ts';
import { verifyAccessToken } from '../utils/jwt.util.ts';
import { prisma } from '../../../config/db/database.config.ts';
import { redisConnection } from '../../../config/redis/redis.config.ts';

const USER_CACHE_TTL_SEC = 60;

interface CachedUser {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
}

const getCachedUser = async (userId: number): Promise<CachedUser | null> => {
  const cacheKey = `user:auth:${userId}`;
  const cached = await redisConnection.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as CachedUser;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user) return null;

  await redisConnection.set(cacheKey, JSON.stringify(user), 'EX', USER_CACHE_TTL_SEC);
  return user;
};

export const invalidateUserCache = async (userId: number): Promise<void> => {
  await redisConnection.del(`user:auth:${userId}`);
};

export const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      return next(new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED));
    }

    const decoded = verifyAccessToken(token);

    const user = await getCachedUser(decoded.userId);
    if (!user) {
      return next(new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.UNAUTHORIZED));
    }

    if (!user.isActive) {
      return next(new AppError(MESSAGES.AUTH.ACCOUNT_DEACTIVATED, HTTP_STATUS.FORBIDDEN));
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED));
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN));
    }

    next();
  };
};