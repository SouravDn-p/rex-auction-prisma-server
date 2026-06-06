import { type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../common/interceptors/response.util.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AuthService } from "./auth.service.ts";
import { setAuthCookies, clearAuthCookies } from "../../common/utils/cookie.util.ts";
import passport from "../../../config/passport.config.ts";

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens } = await AuthService.register(req.body);
      setAuthCookies(res, tokens);
      sendSuccess(res, HTTP_STATUS.CREATED, MESSAGES.AUTH.REGISTER_SUCCESS, { user, accessToken: tokens.accessToken });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens } = await AuthService.login(req.body);
      setAuthCookies(res, tokens);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGIN_SUCCESS, { user, accessToken: tokens.accessToken });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        const user = req.user as any;
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        await AuthService.logout(user.userId, token);
      }
      clearAuthCookies(res);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGOUT_SUCCESS);
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      const { user, tokens } = await AuthService.refreshToken(token);
      setAuthCookies(res, tokens);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.TOKEN_REFRESHED, { user, accessToken: tokens.accessToken });
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
      const user = req.user as any;
      const userProfile = await AuthService.getUserProfile(user.userId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.USER.FETCHED, { user: userProfile });
    } catch (error) {
      next(error);
    }
  }


  // Google OAuth handlers will go here (e.g., googleAuth, googleAuthCallback)
  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })(req, res, next);
  }

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    passport.authenticate("google", { session: false }, async (err: any, profile: any) => {
      if (err || !profile) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }

      try {
        const { tokens } = await AuthService.googleLogin(profile);
        setAuthCookies(res, tokens);
        return res.redirect(`${process.env.FRONTEND_URL}?success=true`);
      } catch (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }
    })(req, res, next);
  }
}