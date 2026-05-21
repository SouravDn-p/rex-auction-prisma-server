import Joi from "joi";
import { SellerRequestStatus } from "@prisma/client";

export const updateUserDtoSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  photo: Joi.string().trim().uri().optional().allow(null, ""),
  cover: Joi.string().trim().uri().optional().allow(null, ""),
  location: Joi.string().trim().max(100).optional().allow(null, ""),
});

export const submitSellerRequestDtoSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(255).required(),
  contactPhone: Joi.string().trim().min(5).max(50).required(),
  address: Joi.string().trim().min(5).required(),
  taxId: Joi.string().trim().min(3).max(100).required(),
  additionalNotes: Joi.string().trim().max(1000).optional().allow(null, ""),
});

export const reviewSellerRequestDtoSchema = Joi.object({
  status: Joi.string()
    .valid(SellerRequestStatus.approved, SellerRequestStatus.rejected)
    .required(),
});

export const updateUserStatusDtoSchema = Joi.object({
  isActive: Joi.boolean().required(),
});
