import type { Request, Response, NextFunction } from 'express';
import { MESSAGES } from '../constants/messages.constants.ts';
import { AppError } from '../exceptions/app-error.exception.ts';
import { HTTP_STATUS } from '../constants/http-status.constants.ts';
import { verifyAccessToken } from '../utils/jwt.util.ts';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      throw new AppError(MESSAGES.AUTH.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;

    next();
  } catch (error) {
    next(error);
  }
};
