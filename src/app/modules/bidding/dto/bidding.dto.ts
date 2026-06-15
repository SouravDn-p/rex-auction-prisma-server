import Joi from 'joi';

export const placeBidDtoSchema = Joi.object({
  auctionId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().precision(2).required(),
});

export const setAutoBidDtoSchema = Joi.object({
  auctionId: Joi.number().integer().positive().required(),
  maxBid: Joi.number().positive().precision(2).required(),
  incrementStep: Joi.number().positive().precision(2).min(0.01).required(),
});