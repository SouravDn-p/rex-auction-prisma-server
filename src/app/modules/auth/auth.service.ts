import type { User } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { prisma } from "../../../config/db/database.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../common/utils/jwt.util.ts";
import type { RegisterDto, LoginDto, SafeUser, AuthTokens } from "./interfaces/auth.interface.ts";

const sanitizeUser = (user: User): SafeUser => {
  const { password: _password, refreshToken: _refreshToken, ...safeUser } = user;
  return safeUser;
};

export class AuthService {
  static async register(dto: RegisterDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const exists = await prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new AppError(MESSAGES.AUTH.EMAIL_EXISTS, HTTP_STATUS.CONFLICT);
    }

    const hashedPassword = await bcryptjs.hash(dto.password, 12);

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
    });

    const tokens = {
      accessToken: generateAccessToken({ userId: user.id, email: user.email, role: user.role }),
      refreshToken: generateRefreshToken({ userId: user.id, email: user.email, role: user.role }),
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return { user: sanitizeUser(user), tokens };
  }

  static async login(dto: LoginDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new AppError(MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const isMatch = await bcryptjs.compare(dto.password, user.password);
    if (!isMatch) {
      throw new AppError(MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const tokens = {
      accessToken: generateAccessToken({ userId: user.id, email: user.email, role: user.role }),
      refreshToken: generateRefreshToken({ userId: user.id, email: user.email, role: user.role }),
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return { user: sanitizeUser(user), tokens };
  }

  static async logout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  static async refreshToken(token: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    try {
      const decoded = verifyRefreshToken(token);

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.isActive || user.refreshToken !== token) {
        throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
      }

      const tokens = {
        accessToken: generateAccessToken({ userId: user.id, email: user.email, role: user.role }),
        refreshToken: generateRefreshToken({ userId: user.id, email: user.email, role: user.role }),
      };

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });

      return { user: sanitizeUser(user), tokens };
    } catch (error) {
      throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static async getUserProfile(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    return sanitizeUser(user);
  }
}