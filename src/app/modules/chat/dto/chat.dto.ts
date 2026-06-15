import Joi from 'joi';

export const startConversationDtoSchema = Joi.object({
  otherUserId: Joi.number().integer().positive().required(),
  auctionId: Joi.number().integer().positive().optional(),
});

export const sendMessageDtoSchema = Joi.object({
  conversationId: Joi.number().integer().positive().required(),
  text: Joi.string().trim().min(1).max(2000).required(),
});

export const markReadDtoSchema = Joi.object({
  conversationId: Joi.number().integer().positive().required(),
});

export const reportUserDtoSchema = Joi.object({
  reportedUserId: Joi.number().integer().positive().required(),
  reason: Joi.string().trim().max(255).required(),
  description: Joi.string().trim().max(1000).allow(null, ''),
});

export const paginationQuerySchema = Joi.object({
  cursor: Joi.number().integer().positive().optional(),
  limit: Joi.number().integer().min(1).max(100).default(30),
});