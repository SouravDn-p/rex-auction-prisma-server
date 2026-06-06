# Authentication System & Flows

This project implements a secure, scalable authentication system utilizing both local credentials and Google OAuth. It relies on a robust JWT-based architecture with HTTP-only cookies to ensure maximum security against common web vulnerabilities (like XSS and CSRF).

## 1. Local Authentication Flow (Email & Password)

The local flow manages standard registration and login using encrypted credentials.

### Registration
1. **Request**: The client sends a `POST` request to `/auth/register` with `name`, `email`, and `password`.
2. **Validation**: The payload is validated using strict Joi schemas.
3. **Database Execution**: Prisma creates a new `User` record with the password securely hashed using `bcryptjs`. An associated `UserStats` record is also created in a transaction.
4. **Token Generation**: Short-lived `accessToken` and long-lived `refreshToken` are generated. The refresh token is hashed and stored in the `UserToken` table.
5. **Cookie Delivery**: Tokens are injected into secure, HTTP-only cookies (`accessToken` & `refreshToken`) in the response headers.

### Login
1. **Request**: Client sends `POST` to `/auth/login` with `email` and `password`.
2. **Validation**: Checks for existing active user and verifies password hash using `bcryptjs.compare`.
3. **Token & Cookie Generation**: Similar to registration, a fresh pair of tokens is created, logged in the database, and attached to the response via HTTP-only cookies.

---

## 2. Google OAuth Integration Flow

We use `passport-google-oauth20` along with custom API-first logic to seamlessly handle Google OAuth without traditional session storage.

### Flow Breakdown
1. **Initiation**: The client navigates to `/auth/google`. Passport redirects the user to the Google Consent screen.
2. **Callback Handling**: After consent, Google redirects the user back to `/auth/google/callback` with an authorization code.
3. **Passport Profile Fetch**: The `passport.authenticate('google', { session: false })` middleware intercepts the callback, validates the code, and extracts the user's Google profile (ID, name, email, avatar).
4. **Service Logic (`AuthService.googleLogin`)**: 
   - Queries the database to find an existing user by Google `providerId` or `email`.
   - **If no user exists**: Creates a new user with a randomized password hash, setting the provider as `google` and storing their avatar.
   - **If user exists but unlinked**: Updates the existing record to link their Google `providerId`.
   - Generates the standard JWT `accessToken` and `refreshToken` pair.
5. **Cookie Delivery & Redirect**: The callback controller receives the tokens, injects them into HTTP-only cookies, and finally redirects the user to the frontend application (`/google-login?success=true`). The client is now seamlessly authenticated.

---

## 3. Session Security & Token Rotation

The server enforces strict session management:

*   **HTTP-Only Cookies**: Tokens are never exposed to the frontend JavaScript. They are automatically sent by the browser in subsequent API requests.
*   **Token Rotation**: When an `accessToken` expires (e.g., 15m), the client can call `/auth/refresh-token`. The server validates the existing refresh token, revokes it in the database, and issues a brand new `accessToken` and `refreshToken` pair to prevent token hijacking.
*   **Logout**: A `POST` to `/auth/logout` revokes the refresh token in the database and clears the auth cookies from the browser.
*   **Protection Middleware (`protect`)**: Extracts the `accessToken` from cookies or `Authorization` headers, verifies the JWT signature, and attaches the active user payload to `req.user`.
