import { googleAuthPath } from "./paths/google/google-login.path.ts";
import { loginPath } from "./paths/login.path.ts";
import { logoutPath } from "./paths/logout.path.ts";
import { mePath } from "./paths/me.path.ts";
import { refreshTokenPath } from "./paths/refresh-token.path.ts";
import { registerPath } from "./paths/register.path.ts";

export const authpaths = {
  "/auth/register": registerPath,
  "/auth/login": loginPath,
  "/auth/logout": logoutPath,
  "/auth/refresh-token": refreshTokenPath,
  "/auth/me": mePath,
  
  "/auth/google": googleAuthPath,
  "/auth/google/callback": googleAuthPath,
};