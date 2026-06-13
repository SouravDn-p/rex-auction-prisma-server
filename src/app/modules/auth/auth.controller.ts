import { type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../common/interceptors/response.util.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AuthService } from "./auth.service.ts";
import { setAuthCookies, clearAuthCookies } from "../../common/utils/cookie.util.ts";
import passport from "../../../config/passport.config.ts";
import type { DeviceInfo } from "./interfaces/auth.interface.ts";

const getDeviceInfo = (req: Request): DeviceInfo => ({
  ...(req.ip ? { ipAddress: req.ip } : {}),
  ...(req.headers["user-agent"] ? { userAgent: req.headers["user-agent"] } : {}),
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user } = await AuthService.register(req.body);
      sendSuccess(res, HTTP_STATUS.CREATED, MESSAGES.AUTH.REGISTER_SUCCESS, {
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens } = await AuthService.verifyEmailOtp(req.body);
      setAuthCookies(res, tokens);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.OTP_VERIFIED, { user });
    } catch (error) {
      next(error);
    }
  }

  async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.resendOtp(req.body);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.OTP_SENT);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.forgotPassword(req.body);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.PASSWORD_RESET_SENT);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.resetPassword(req.body);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.PASSWORD_RESET_SUCCESS);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens } = await AuthService.login(req.body, getDeviceInfo(req));
      setAuthCookies(res, tokens);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGIN_SUCCESS, { user });
    } catch (error) {
      next(error);
    }
  }

  // Logout current device only
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await AuthService.logout(req.user.userId, req.cookies?.refreshToken);
      }
      clearAuthCookies(res);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGOUT_SUCCESS);
    } catch (error) {
      next(error);
    }
  }

  // Logout from every device
  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await AuthService.logoutAll(req.user.userId);
      }
      clearAuthCookies(res);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGOUT_ALL_SUCCESS);
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await AuthService.getActiveSessions(req.user!.userId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.USER.FETCHED, { sessions });
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = Number(req.params.sessionId);
      await AuthService.revokeSession(req.user!.userId, sessionId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGOUT_SUCCESS);
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens } = await AuthService.refreshToken(
        req.cookies?.refreshToken,
        getDeviceInfo(req)
      );
      setAuthCookies(res, tokens);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.TOKEN_REFRESHED, { user });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendSuccess(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED);
        return;
      }
      const userProfile = await AuthService.getUserProfile(req.user.userId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.USER.FETCHED, { user: userProfile });
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
  }

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    passport.authenticate("google", { session: false }, async (err: any, profile: any) => {
      if (err || !profile) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }

      try {
        const { tokens } = await AuthService.googleLogin(profile, getDeviceInfo(req));
        setAuthCookies(res, tokens);
        return res.redirect(`${process.env.FRONTEND_URL}?success=true`);
      } catch (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }
    })(req, res, next);
  }
}