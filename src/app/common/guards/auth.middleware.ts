import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../exceptions/app-error.exception.ts';
import { HTTP_STATUS } from '../constants/http-status.constants.ts';
import { MESSAGES } from '../constants/messages.constants.ts';
import { verifyAccessToken } from '../utils/jwt.util.ts';
import { prisma } from '../../../config/db/database.config.ts';

export const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Get token from Authorization header or cookies
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(
        new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
      );
    }

    // 2. Verify token
    const decoded = verifyAccessToken(token);

    // 3. Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return next(
        new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.UNAUTHORIZED)
      );
    }

    // 4. Check if user is active
    if (!user.isActive) {
      return next(
        new AppError('Your account has been deactivated', HTTP_STATUS.FORBIDDEN)
      );
    }

    // 5. Grant access and store user details on request
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
      return next(
        new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
      );
    }

    const user = req.user as any;
    if (!roles.includes(user.role)) {
      return next(
        new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
      );
    }

    next();
  };
};
