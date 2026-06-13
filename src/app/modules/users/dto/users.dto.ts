import Joi from 'joi';
import { SellerRequestStatus } from '@prisma/client';

export const updateUserDtoSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  photo: Joi.string().uri().allow(null, ''),
  cover: Joi.string().uri().allow(null, ''),
  location: Joi.string().trim().max(255).allow(null, ''),
}).min(1);

export const submitSellerRequestDtoSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(255).required(),
  contactPhone: Joi.string().trim().min(6).max(50).required(),
  address: Joi.string().trim().min(5).required(),
  taxId: Joi.string().trim().min(3).max(100).required(),
  additionalNotes: Joi.string().trim().max(1000).allow(null, ''),
});

export const reviewSellerRequestDtoSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(SellerRequestStatus).filter((s) => s !== 'pending'))
    .required(),
});

export const updateUserStatusDtoSchema = Joi.object({
  isActive: Joi.boolean().required(),
});