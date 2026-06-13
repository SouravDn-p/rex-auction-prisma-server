import Joi from 'joi';

export const verifyOtpDto = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required().messages({
    'string.pattern.base': 'OTP must be a 6-digit number',
  }),
});

export const resendOtpDto = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
});