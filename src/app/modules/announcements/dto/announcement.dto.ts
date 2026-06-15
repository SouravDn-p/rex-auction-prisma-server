import Joi from 'joi';

export const createAnnouncementDtoSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  content: Joi.string().trim().min(10).required(),
  date: Joi.date().iso().allow(null, ''),
  isActive: Joi.boolean().default(true),
});

export const updateAnnouncementDtoSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255),
  content: Joi.string().trim().min(10),
  date: Joi.date().iso().allow(null, ''),
  isActive: Joi.boolean(),
}).min(1);
