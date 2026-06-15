import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  PORT: Number(process.env.PORT) || 5000,

  DATABASE_URL: required('DATABASE_URL'),

  FRONTEND_URL: required('FRONTEND_URL'),
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000, // keep in sync with JWT_REFRESH_EXPIRES_IN

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || '',

  SESSION_SECRET: required('SESSION_SECRET'),


  //brevo api key and email config
  BREVO_API_KEY: required('BREVO_API_KEY'),
  MAIL_FROM: required('MAIL_FROM'),
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'Rex Auction',

  REDIS_URL: process.env.REDIS_URL!,


  SSLCOMMERZ_STORE_ID: required('SSLCOMMERZ_STORE_ID'),
  SSLCOMMERZ_STORE_PASSWORD: required('SSLCOMMERZ_STORE_PASSWORD'),
  SSLCOMMERZ_IS_LIVE: process.env.SSLCOMMERZ_IS_LIVE === 'true',
  
  //otp config

  OTP_EXPIRES_MIN: Number(process.env.OTP_EXPIRES_MIN) || 10,
};