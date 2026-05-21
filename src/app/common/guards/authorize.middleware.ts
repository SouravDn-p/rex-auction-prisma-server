import type { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants/http-status.constants.ts";
import { MESSAGES } from "../constants/messages.constants.ts";
import { AppError } from "../exceptions/app-error.exception.ts";

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }
    next();
  };
};