import { googleAuthPath } from "./paths/google/google-login.path.ts";
import { googleCallbackPath } from "./paths/google/gooogle-callback.path.ts";
import { forgotPasswordPath } from "./paths/forgot-password.path.ts";
import { loginPath } from "./paths/login.path.ts";
import { logoutAllPath } from "./paths/logout-all.path.ts";
import { logoutPath } from "./paths/logout.path.ts";
import { mePath } from "./paths/me.path.ts";
import { refreshTokenPath } from "./paths/refresh-token.path.ts";
import { registerPath } from "./paths/register.path.ts";
import { resendOtpPath } from "./paths/resend-otp.path.ts";
import { resetPasswordPath } from "./paths/reset-password.path.ts";
import { revokeSessionPath } from "./paths/revoke-session.path.ts";
import { sessionsPath } from "./paths/sessions.path.ts";
import { verifyEmailPath } from "./paths/verify-email.path.ts";

export const authpaths = {
  "/auth/register": registerPath,
  "/auth/verify-email": verifyEmailPath,
  "/auth/resend-otp": resendOtpPath,
  "/auth/forgot-password": forgotPasswordPath,
  "/auth/reset-password": resetPasswordPath,
  "/auth/login": loginPath,
  "/auth/logout": logoutPath,
  "/auth/logout-all": logoutAllPath,
  "/auth/sessions": sessionsPath,
  "/auth/sessions/{sessionId}": revokeSessionPath,
  "/auth/refresh-token": refreshTokenPath,
  "/auth/me": mePath,
  "/auth/google": googleAuthPath,
  "/auth/google/callback": googleCallbackPath,
};
