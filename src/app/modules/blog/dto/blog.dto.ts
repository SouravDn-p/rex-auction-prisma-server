import Joi from 'joi';

const tagsField = Joi.alternatives()
  .try(
    Joi.array().items(Joi.string().trim().max(100)).max(10),
    Joi.string().trim().max(1000)
  )
  .default([]);

export const createBlogDtoSchema = Joi.object({
  title: Joi.string().trim().min(5).max(255).required(),
  excerpt: Joi.string().trim().max(500).allow(null, ''),
  fullContent: Joi.string().trim().min(50).required(),
  tags: tagsField,
});

export const updateBlogDtoSchema = Joi.object({
  title: Joi.string().trim().min(5).max(255),
  excerpt: Joi.string().trim().max(500).allow(null, ''),
  fullContent: Joi.string().trim().min(50),
  tags: tagsField,
}).min(1);
