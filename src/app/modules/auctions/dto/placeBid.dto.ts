import Joi from "joi";

export const placeBidDto = Joi.object({
  auctionId: Joi.number().required(),
  userId: Joi.number().required(),
  amount: Joi.number().positive().required(),
});