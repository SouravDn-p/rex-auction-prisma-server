import Joi from "joi";

export const updateAuctionDto = Joi.object({
  title: Joi.string().min(3).max(255),
  description: Joi.string().allow("", null),
  images: Joi.array().items(Joi.string().uri()),
  category: Joi.string().max(100),
  startingPrice: Joi.number().positive(),
  endTime: Joi.date().iso(),
  notes: Joi.string().allow("", null),
});