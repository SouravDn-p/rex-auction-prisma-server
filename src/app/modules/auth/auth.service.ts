import type { User } from "@prisma/client";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
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

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const sanitizeUser = (user: User): SafeUser => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

export class AuthService {
  static async register(dto: RegisterDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const exists = await prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new AppError(MESSAGES.AUTH.EMAIL_EXISTS, HTTP_STATUS.CONFLICT);
    }

    const hashedPassword = await bcryptjs.hash(dto.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
        },
      });

      await tx.userStats.create({
        data: {
          userId: newUser.id,
          accountBalance: 0,
          auctionsWon: 0,
          activeBids: 0,
          totalSpent: 0,
        },
      });

      return newUser;
    });

    const tokens = {
      accessToken: generateAccessToken({ userId: user.id, email: user.email, role: user.role }),
      refreshToken: generateRefreshToken({ userId: user.id, email: user.email, role: user.role }),
    };

    // Store refresh token in database
    await prisma.userToken.create({
      data: {
        userId: user.id,
        tokenType: "refresh",
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
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

    // Store refresh token in database
    await prisma.userToken.create({
      data: {
        userId: user.id,
        tokenType: "refresh",
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { user: sanitizeUser(user), tokens };
  }

  static async logout(userId: number, token?: string): Promise<void> {
    if (token) {
      await prisma.userToken.deleteMany({
        where: {
          userId,
          tokenHash: hashToken(token),
        },
      });
    } else {
      await prisma.userToken.deleteMany({
        where: {
          userId,
          tokenType: "refresh",
        },
      });
    }
  }

  static async refreshToken(token: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    if (!token) {
      throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    try {
      const decoded = verifyRefreshToken(token);
      const tokenHash = hashToken(token);

      // Check if refresh token exists in DB and is not expired
      const storedToken = await prisma.userToken.findFirst({
        where: {
          tokenHash,
          tokenType: "refresh",
          userId: decoded.userId,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: true,
        },
      });

      if (!storedToken || !storedToken.user || !storedToken.user.isActive) {
        throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
      }

      // Generate new token pair (Rotation)
      const tokens = {
        accessToken: generateAccessToken({
          userId: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
        }),
        refreshToken: generateRefreshToken({
          userId: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
        }),
      };

      // In a transaction, delete old token and insert new one
      await prisma.$transaction([
        prisma.userToken.delete({ where: { id: storedToken.id } }),
        prisma.userToken.create({
          data: {
            userId: storedToken.user.id,
            tokenType: "refresh",
            tokenHash: hashToken(tokens.refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      return { user: sanitizeUser(storedToken.user), tokens };
    } catch (error) {
      throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static async getUserProfile(userId: number): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    return sanitizeUser(user);
  }

  static async googleLogin(profile: any): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const { googleId, name, email, avatar } = profile;

    let user = await prisma.user.findFirst({
      // where: {
      //   OR: [
      //     { providerId: googleId, provider: "google" },
      //     { email: email }
      //   ]
      // }
      where: {
        provider: "google",
        providerId: googleId,
      },
    });

    if (!user) {
      const existingEmailUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmailUser) {
        throw new AppError(
          "This email is already registered. Please try login again using email and password.",
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      const hashedPassword = await bcryptjs.hash(crypto.randomBytes(16).toString("hex"), 12);
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: name,
            email: email,
            password: hashedPassword,
            provider: "google",
            providerId: googleId,
            photo: avatar,
          },
        });

        await tx.userStats.create({
          data: {
            userId: newUser.id,
            accountBalance: 0,
            auctionsWon: 0,
            activeBids: 0,
            totalSpent: 0,
          },
        });

        return newUser;
      });
    } else if (user.provider !== "google" || user.providerId !== googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          provider: "google",
          providerId: googleId,
          ...(user.photo ? {} : { photo: avatar })
        }
      });
    }

    if (!user.isActive) {
      throw new AppError(MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const tokens = {
      accessToken: generateAccessToken({ userId: user.id, email: user.email, role: user.role }),
      refreshToken: generateRefreshToken({ userId: user.id, email: user.email, role: user.role }),
    };

    await prisma.userToken.create({
      data: {
        userId: user.id,
        tokenType: "refresh",
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { user: sanitizeUser(user), tokens };
  }
}