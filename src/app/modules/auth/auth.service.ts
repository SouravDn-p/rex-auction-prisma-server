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
import { generateOtp, hashOtp } from "../../common/utils/otp.util.ts";
import { emailQueue } from "../../../config/bull/queue.config.ts";
import { ENV } from "../../../config/env.config.ts";
import {
  otpVerificationTemplate,
  passwordResetTemplate,
  welcomeEmailTemplate,
} from "../../../services/templates/email-templates.ts";
import type {
  RegisterDto,
  LoginDto,
  SafeUser,
  AuthTokens,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  DeviceInfo,
} from "./interfaces/auth.interface.ts";

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const sanitizeUser = (user: User): SafeUser => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const OTP_EXPIRES_MS = ENV.OTP_EXPIRES_MIN * 60 * 1000;
const REFRESH_EXPIRES_MS = ENV.REFRESH_TOKEN_TTL_MS;

const sessionDeviceFields = (device?: DeviceInfo) => ({
  ...(device?.ipAddress ? { ipAddress: device.ipAddress } : {}),
  ...(device?.userAgent ? { userAgent: device.userAgent } : {}),
  ...(device && (device.ipAddress || device.userAgent)
    ? {
        deviceInfo: {
          ...(device.ipAddress ? { ip: device.ipAddress } : {}),
          ...(device.userAgent ? { ua: device.userAgent } : {}),
        },
      }
    : {}),
});

export class AuthService {
  // ─────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────
  static async register(dto: RegisterDto): Promise<{ user: SafeUser }> {
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
          emailVerified: false,
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

    await AuthService.issueAndSendOtp(user, "emailVerification");

    return { user: sanitizeUser(user) };
  }

  // ─────────────────────────────────────────────────────────────
  // OTP ISSUING (shared by register + resend + forgot-password)
  // ─────────────────────────────────────────────────────────────
  private static async issueAndSendOtp(
    user: User,
    tokenType: "emailVerification" | "passwordReset"
  ): Promise<void> {
    const otp = generateOtp(6);
    const otpHash = hashOtp(otp);

    // Invalidate any previous OTPs of this type for the user
    await prisma.userToken.deleteMany({
      where: { userId: user.id, tokenType },
    });

    await prisma.userToken.create({
      data: {
        userId: user.id,
        tokenType,
        tokenHash: otpHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRES_MS),
      },
    });

    const subject =
      tokenType === "emailVerification"
        ? "Verify your Rex Auction account"
        : "Reset your Rex Auction password";

    const htmlContent =
      tokenType === "emailVerification"
        ? otpVerificationTemplate(user.name, otp, ENV.OTP_EXPIRES_MIN)
        : passwordResetTemplate(user.name, otp, ENV.OTP_EXPIRES_MIN);

    await emailQueue.add("send-otp", {
      to: user.email,
      toName: user.name,
      subject,
      htmlContent,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // VERIFY EMAIL OTP
  // ─────────────────────────────────────────────────────────────
  static async verifyEmailOtp(dto: VerifyOtpDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new AppError(MESSAGES.AUTH.OTP_INVALID, HTTP_STATUS.BAD_REQUEST);
    }

    if (user.emailVerified) {
      throw new AppError(MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED, HTTP_STATUS.CONFLICT);
    }

    const otpHash = hashOtp(dto.otp);
    const storedOtp = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        tokenType: "emailVerification",
        tokenHash: otpHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedOtp) {
      throw new AppError(MESSAGES.AUTH.OTP_INVALID, HTTP_STATUS.BAD_REQUEST);
    }

    const verifiedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });

      await tx.userToken.deleteMany({
        where: { userId: user.id, tokenType: "emailVerification" },
      });

      return updated;
    });

    await emailQueue.add("send-welcome", {
      to: verifiedUser.email,
      toName: verifiedUser.name,
      subject: "Welcome to Rex Auction",
      htmlContent: welcomeEmailTemplate(verifiedUser.name),
    });

    const tokens = await AuthService.issueSession(verifiedUser);

    return { user: sanitizeUser(verifiedUser), tokens };
  }

  // ─────────────────────────────────────────────────────────────
  // RESEND OTP
  // ─────────────────────────────────────────────────────────────
  static async resendOtp(dto: ResendOtpDto): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      // Don't reveal whether the email exists
      return;
    }

    if (user.emailVerified) {
      throw new AppError(MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED, HTTP_STATUS.CONFLICT);
    }

    // Rate-limit: check if a recent OTP was issued (< 60s ago)
    const recentOtp = await prisma.userToken.findFirst({
      where: { userId: user.id, tokenType: "emailVerification" },
      orderBy: { createdAt: "desc" },
    });

    if (recentOtp) {
      const ageMs = Date.now() - recentOtp.createdAt.getTime();
      const minIntervalMs = 60 * 1000;
      if (ageMs < minIntervalMs) {
        throw new AppError(
          `Please wait ${Math.ceil((minIntervalMs - ageMs) / 1000)}s before requesting another code`,
          HTTP_STATUS.TOO_MANY_REQUESTS
        );
      }
    }

    await AuthService.issueAndSendOtp(user, "emailVerification");
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ─────────────────────────────────────────────────────────────
  static async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      // Don't reveal account existence
      return;
    }

    await AuthService.issueAndSendOtp(user, "passwordReset");
  }

  // ─────────────────────────────────────────────────────────────
  // RESET PASSWORD
  // ─────────────────────────────────────────────────────────────
  static async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new AppError(MESSAGES.AUTH.OTP_INVALID, HTTP_STATUS.BAD_REQUEST);
    }

    const otpHash = hashOtp(dto.otp);
    const storedOtp = await prisma.userToken.findFirst({
      where: {
        userId: user.id,
        tokenType: "passwordReset",
        tokenHash: otpHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedOtp) {
      throw new AppError(MESSAGES.AUTH.OTP_INVALID, HTTP_STATUS.BAD_REQUEST);
    }

    const hashedPassword = await bcryptjs.hash(dto.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Invalidate the reset OTP
      await tx.userToken.deleteMany({
        where: { userId: user.id, tokenType: "passwordReset" },
      });

      // Security: revoke all existing sessions (password change = logout everywhere)
      await tx.userToken.deleteMany({
        where: { userId: user.id, tokenType: "refresh" },
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ISSUE SESSION (shared by login, register-after-verify, google, refresh)
  // ─────────────────────────────────────────────────────────────
  private static async issueSession(user: User, device?: DeviceInfo): Promise<AuthTokens> {
    const tokens = {
      accessToken: generateAccessToken({ userId: user.id, email: user.email, role: user.role }),
      refreshToken: generateRefreshToken({ userId: user.id, email: user.email, role: user.role }),
    };

    await prisma.userToken.create({
      data: {
        userId: user.id,
        tokenType: "refresh",
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
        ...sessionDeviceFields(device),
      },
    });

    return tokens;
  }

  // ─────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────
  static async login(
    dto: LoginDto,
    device?: DeviceInfo
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new AppError(MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    if (!user.isActive) {
      throw new AppError(MESSAGES.AUTH.ACCOUNT_DEACTIVATED, HTTP_STATUS.FORBIDDEN);
    }

    const isMatch = await bcryptjs.compare(dto.password, user.password);
    if (!isMatch) {
      throw new AppError(MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    if (!user.emailVerified) {
      // Re-issue OTP so the user can verify immediately
      await AuthService.issueAndSendOtp(user, "emailVerification");
      throw new AppError(MESSAGES.AUTH.EMAIL_NOT_VERIFIED, HTTP_STATUS.FORBIDDEN);
    }

    const tokens = await AuthService.issueSession(user, device);

    return { user: sanitizeUser(user), tokens };
  }

  // ─────────────────────────────────────────────────────────────
  // LOGOUT — single device (current session only)
  // ─────────────────────────────────────────────────────────────
  static async logout(userId: number, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.userToken.deleteMany({
        where: {
          userId,
          tokenType: "refresh",
          tokenHash: hashToken(refreshToken),
        },
      });
    }
    // If no token provided, nothing to revoke server-side for this device —
    // client should still clear cookies. We do NOT wipe all sessions here.
  }

  // ─────────────────────────────────────────────────────────────
  // LOGOUT ALL — every device
  // ─────────────────────────────────────────────────────────────
  static async logoutAll(userId: number): Promise<void> {
    await prisma.userToken.deleteMany({
      where: { userId, tokenType: "refresh" },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // REFRESH TOKEN (with rotation + theft detection)
  // ─────────────────────────────────────────────────────────────
  static async refreshToken(
    token: string,
    device?: DeviceInfo
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    if (!token) {
      throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    const tokenHash = hashToken(token);

    const storedToken = await prisma.userToken.findFirst({
      where: {
        tokenHash,
        tokenType: "refresh",
        userId: decoded.userId,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!storedToken) {
      // Token not found — could be expired, or a REUSED/STOLEN rotated token.
      // Theft signal: a valid token exists for this user with different hash
      // but the presented (decoded) token was issued for this user.
      // As a precaution, revoke all sessions for this user.
      const anyValidSession = await prisma.userToken.findFirst({
        where: { userId: decoded.userId, tokenType: "refresh", expiresAt: { gt: new Date() } },
      });

      if (anyValidSession) {
        await prisma.userToken.deleteMany({
          where: { userId: decoded.userId, tokenType: "refresh" },
        });
      }

      throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    if (!storedToken.user || !storedToken.user.isActive) {
      throw new AppError(MESSAGES.AUTH.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

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

    const ipAddress = device?.ipAddress ?? storedToken.ipAddress ?? undefined;
    const userAgent = device?.userAgent ?? storedToken.userAgent ?? undefined;

    // Rotate: delete old, create new (preserve device info)
    await prisma.$transaction([
      prisma.userToken.delete({ where: { id: storedToken.id } }),
      prisma.userToken.create({
        data: {
          userId: storedToken.user.id,
          tokenType: "refresh",
          tokenHash: hashToken(tokens.refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
          ...(storedToken.deviceInfo != null ? { deviceInfo: storedToken.deviceInfo } : {}),
          lastUsedAt: new Date(),
        },
      }),
    ]);

    return { user: sanitizeUser(storedToken.user), tokens };
  }

  // ─────────────────────────────────────────────────────────────
  // GET PROFILE
  // ─────────────────────────────────────────────────────────────
  static async getUserProfile(userId: number): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    return sanitizeUser(user);
  }

  // ─────────────────────────────────────────────────────────────
  // GET ACTIVE SESSIONS (for "manage devices" UI)
  // ─────────────────────────────────────────────────────────────
  static async getActiveSessions(userId: number) {
    return prisma.userToken.findMany({
      where: { userId, tokenType: "refresh", expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // LOGOUT a specific session by id (revoke one device from device list)
  // ─────────────────────────────────────────────────────────────
  static async revokeSession(userId: number, sessionId: number): Promise<void> {
    await prisma.userToken.deleteMany({
      where: { id: sessionId, userId, tokenType: "refresh" },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // GOOGLE LOGIN (auto-verified)
  // ─────────────────────────────────────────────────────────────
  static async googleLogin(
    profile: any,
    device?: DeviceInfo
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const { googleId, name, email, avatar } = profile;

    let user = await prisma.user.findFirst({
      where: { provider: "google", providerId: googleId },
    });

    if (!user) {
      const existingEmailUser = await prisma.user.findUnique({ where: { email } });

      if (existingEmailUser) {
        if (existingEmailUser.provider === "local") {
          throw new AppError(
            "This email is registered with a password. Please log in using email and password.",
            HTTP_STATUS.CONFLICT
          );
        }
        // Different OAuth provider already owns this email
        throw new AppError(
          "This email is already registered with a different provider.",
          HTTP_STATUS.CONFLICT
        );
      }

      const hashedPassword = await bcryptjs.hash(crypto.randomBytes(16).toString("hex"), 12);

      try {
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              name,
              email,
              password: hashedPassword,
              provider: "google",
              providerId: googleId,
              photo: avatar,
              emailVerified: true, // Google already verified this email
            },
          });

          await tx.userStats.create({
            data: { userId: newUser.id, accountBalance: 0, auctionsWon: 0, activeBids: 0, totalSpent: 0 },
          });

          return newUser;
        });

        await emailQueue.add("send-welcome", {
          to: user.email,
          toName: user.name,
          subject: "Welcome to Rex Auction",
          htmlContent: welcomeEmailTemplate(user.name),
        });
      } catch (err: any) {
        // Handle race condition: concurrent first-time Google logins
        if (err?.code === "P2002") {
          user = await prisma.user.findUnique({ where: { email } });
          if (!user) throw new AppError(MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
        } else {
          throw err;
        }
      }
    }

    if (!user.isActive) {
      throw new AppError(MESSAGES.AUTH.ACCOUNT_DEACTIVATED, HTTP_STATUS.FORBIDDEN);
    }

    const tokens = await AuthService.issueSession(user, device);

    return { user: sanitizeUser(user), tokens };
  }
}