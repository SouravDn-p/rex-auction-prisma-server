import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '../exceptions/app-error.exception.ts';
import { HTTP_STATUS } from '../constants/http-status.constants.ts';

export const validateDto = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,   // report ALL errors, not just the first
      stripUnknown: true,  // silently drop extra fields
    });

    if (error) {
      const message = error.details.map((d) => d.message.replace(/"/g, '')).join(', ');
      return next(new AppError(message, HTTP_STATUS.BAD_REQUEST));
    }

    req.body = value; // use the sanitized/cast value
    next();
  };
};