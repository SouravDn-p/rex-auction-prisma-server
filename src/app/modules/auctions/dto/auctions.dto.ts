import Joi from 'joi';

export const createAuctionDtoSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  description: Joi.string().trim().min(10).required(),
  itemCondition: Joi.string().trim().max(50).required(),
  itemYear: Joi.number().integer().min(1800).max(new Date().getFullYear()).required(),
  itemReference: Joi.string().trim().max(100).required(),
  itemValuation: Joi.number().positive().precision(2).required(),
  history: Joi.string().trim().min(10).required(),
  images: Joi.array().items(Joi.string().uri()).min(1).max(10).required(),
  category: Joi.string().trim().max(100).allow(null, ''),
  startingPrice: Joi.number().positive().precision(2).required(),
  startTime: Joi.date().iso().greater('now').required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  notes: Joi.string().trim().max(1000).allow(null, ''),
});

export const updateAuctionDtoSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255),
  description: Joi.string().trim().min(10),
  itemCondition: Joi.string().trim().max(50),
  itemYear: Joi.number().integer().min(1800).max(new Date().getFullYear()),
  itemReference: Joi.string().trim().max(100),
  itemValuation: Joi.number().positive().precision(2),
  history: Joi.string().trim().min(10),
  images: Joi.array().items(Joi.string().uri()).min(1).max(10),
  category: Joi.string().trim().max(100).allow(null, ''),
  startingPrice: Joi.number().positive().precision(2),
  startTime: Joi.date().iso(),
  endTime: Joi.date().iso(),
  notes: Joi.string().trim().max(1000).allow(null, ''),
}).min(1);

export const adminReviewAuctionDtoSchema = Joi.object({
  status: Joi.string().valid('upcoming', 'cancelled').required(),
  notes: Joi.string().trim().max(1000).allow(null, ''),
});

export const reactionDtoSchema = Joi.object({
  reaction: Joi.string().valid('like', 'love', 'smile', 'wow', 'flag').required(),
});