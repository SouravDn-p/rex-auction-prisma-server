import jwt, {type SignOptions,type JwtPayload } from 'jsonwebtoken';
import { ENV } from '../../../config/env.config.ts';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}
export interface DecodedToken extends TokenPayload, JwtPayload {}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
    expiresIn: ENV.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
    expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
};

export const verifyAccessToken = (token: string): DecodedToken => {
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as DecodedToken;
};

export const verifyRefreshToken = (token: string): DecodedToken => {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as DecodedToken;
};