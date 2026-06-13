import Joi from 'joi';

export const forgotPasswordDto = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
});

export const resetPasswordDto = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
  newPassword: Joi.string()
    .min(8)
    .max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    }),
});