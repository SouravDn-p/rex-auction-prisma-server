import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '../exceptions/app-error.exception.ts';
import { HTTP_STATUS } from '../constants/http-status.constants.ts';

const parseFormFields = (body: Record<string, unknown>): Record<string, unknown> => {
  const parsed = { ...body };

  if (typeof parsed.tags === 'string') {
    const tagsValue = parsed.tags;
    try {
      parsed.tags = JSON.parse(tagsValue) as string[];
    } catch {
      parsed.tags = tagsValue
        .split(',')
        .map((tag: string) => tag.trim())
        .filter(Boolean);
    }
  }

  if (parsed.isActive !== undefined) {
    parsed.isActive = parsed.isActive === 'true' || parsed.isActive === true;
  }

  if (parsed.excerpt === '') {
    parsed.excerpt = null;
  }

  return parsed;
};

const runValidation = (
  req: Request,
  schema: Joi.ObjectSchema,
  next: NextFunction
): void => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message.replace(/"/g, '')).join(', ');
    return next(new AppError(message, HTTP_STATUS.BAD_REQUEST));
  }

  req.body = value;
  next();
};

export const validateDto = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    runValidation(req, schema, next);
  };
};

export const validateFormDto = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = parseFormFields(req.body);
    runValidation(req, schema, next);
  };
};