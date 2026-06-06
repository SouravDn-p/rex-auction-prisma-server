import Joi from "joi";

export const createAuctionDto = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow("", null),
  sellerId: Joi.number().required(),
  images: Joi.array().items(Joi.string().uri()).required(),
  category: Joi.string().max(100).optional(),
  startingPrice: Joi.number().positive().required(),
  endTime: Joi.date().iso().required(),
  notes: Joi.string().allow("", null),
});