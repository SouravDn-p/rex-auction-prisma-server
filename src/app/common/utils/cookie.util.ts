import { type Response } from 'express';
import { ENV } from '../../../config/env.config.ts';

export const cookieOptions = {
  httpOnly: true,
  secure: ENV.IS_PRODUCTION,
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Sets secure, HttpOnly authentication cookies (accessToken and refreshToken) on the response.
 */
export const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
): void => {
  res.cookie('accessToken', tokens.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Clears the authentication cookies from the client browser.
 */
export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};
