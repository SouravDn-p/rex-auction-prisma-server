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
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        await AuthService.logout(req.user.userId, token);
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
      const user = await AuthService.getUserProfile(req.user.userId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.USER.FETCHED, { user });
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

  async googleCallback (req: Request, res: Response, next: NextFunction): Promise<void> {
    passport.authenticate("google", (err: any, user: any) => {
      if (err || !user) {
        return res.redirect("/login");
      }

      req.logIn(user, (err) => {
        if (err) return next(err);

        return res.redirect("/dashboard");
      });
    })(req, res, next);
  }
}