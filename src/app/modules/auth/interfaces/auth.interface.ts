import type { User } from "@prisma/client";

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// What we send to clients — password always omitted
export type SafeUser = Omit<User, 'password'>;