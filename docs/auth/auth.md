# Authentication Guide

This project uses a hybrid authentication model:

* Email/password registration with OTP email verification
* Password reset with OTP
* JWT access tokens for request authorization
* Rotating JWT refresh tokens for session persistence
* Google OAuth for social login

The backend stores refresh-token sessions in the `UserToken` table and keeps access tokens stateless.

## Overview

### Token strategy

* `accessToken` is short-lived and used to authorize protected routes.
* `refreshToken` is longer-lived and used only to mint a new token pair.
* Both tokens are returned as HTTP-only cookies.
* Refresh tokens are hashed before they are persisted in the database.

### Cookie behavior

Cookies are set with:

* `httpOnly: true`
* `sameSite: "lax"`
* `secure: true` in production
* `path: "/"` so they are available across the API

## Required Environment Variables

At minimum, the auth flow depends on:

```ini
DATABASE_URL=
FRONTEND_URL=
BACKEND_URL=
REDIS_URL=
SESSION_SECRET=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OTP_EXPIRES_MIN=10
BREVO_API_KEY=
MAIL_FROM=
MAIL_FROM_NAME=Rex Auction
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
ALLOWED_ORIGINS=
```

## Data Model Used for Sessions

Refresh sessions are stored in `UserToken`:

* `tokenType = refresh`
* `tokenHash` stores a SHA-256 hash of the refresh token
* `expiresAt` controls expiry
* `ipAddress`, `userAgent`, and `deviceInfo` capture session metadata
* `lastUsedAt` is updated on refresh rotation

## OTP Flow with Brevo

OTP is used for two actions:

* email verification
* password reset

### 1. Register

Request:

```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": 1,
      "email": "john@example.com",
      "name": "John Doe"
    }
  }
}
```

Backend behavior:

* creates the user
* creates the `user_stats` row
* generates a 6-digit OTP
* hashes the OTP
* stores it in `UserToken` as `tokenType = emailVerification`
* sends the OTP through Brevo

### Brevo email send flow

The email worker sends transactional mail through Brevo SMTP API:

```ts
const response = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'api-key': ENV.BREVO_API_KEY,
  },
  body: JSON.stringify({
    sender: { name: ENV.MAIL_FROM_NAME, email: ENV.MAIL_FROM },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent,
  }),
});
```

The OTP templates are rendered from:

```ts
otpVerificationTemplate(user.name, otp, ENV.OTP_EXPIRES_MIN)
passwordResetTemplate(user.name, otp, ENV.OTP_EXPIRES_MIN)
```

### 2. Verify email

Request:

```http
POST /auth/verify-email
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456"
}
```

Backend behavior:

* validates the OTP hash and expiry
* marks `emailVerified = true`
* deletes all pending email-verification OTPs
* issues a new access/refresh session
* sets auth cookies on the response

### 3. Resend OTP

Request:

```http
POST /auth/resend-otp
Content-Type: application/json

{
  "email": "john@example.com"
}
```

Rules:

* the user is not revealed if the email does not exist
* a new OTP cannot be requested more than once per minute
* previous OTPs of the same type are invalidated before the new one is stored

## Password Reset Flow

### Forgot password

Request:

```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

Backend behavior:

* looks up the active user
* generates a password-reset OTP
* stores the hashed OTP as `tokenType = passwordReset`
* emails the reset code

### Reset password

Request:

```http
POST /auth/reset-password
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456",
  "newPassword": "NewStrongPassword123!"
}
```

Backend behavior:

* verifies the OTP hash and expiry
* updates the password using bcrypt hashing
* deletes the reset OTP
* deletes all refresh sessions for the user so password changes log the user out everywhere

## Login Flow

Request:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

Backend behavior:

* checks that the account is active
* verifies the password
* blocks login until email verification is complete
* issues a new access/refresh pair
* stores the refresh token session in the database
* includes device info from the request when available

## Refresh Token Flow

### Endpoint

```http
POST /auth/refresh-token
```

The refresh token is read from the `refreshToken` cookie. The implementation is designed around cookie-based refresh rotation.

### What happens

1. The server verifies the refresh JWT signature.
2. The refresh token is hashed and matched against the `UserToken` record.
3. If the token is valid, the old session row is deleted.
4. A new refresh token is created and stored as a new session row.
5. New access and refresh cookies are returned to the client.

### Security behavior

* If a refresh token is reused after rotation, the server treats it as a theft signal and revokes all sessions for that user.
* Rotated sessions keep the latest device metadata and update `lastUsedAt`.

## Access Token Flow

### How access tokens are used

* The access token is sent automatically in the `accessToken` cookie.
* Protected routes read the cookie in the `protect` middleware.
* The token is verified with the access-token secret.
* The middleware loads the user from Redis cache or the database and attaches `req.user`.

### Cache behavior

* User identity for auth checks is cached in Redis for a short TTL.
* If the cache misses, the user is read from Prisma and cached again.

## Session Management

### Current session logout

`POST /auth/logout`

* removes only the current refresh-token session
* clears both auth cookies from the browser

### Logout everywhere

`POST /auth/logout-all`

* removes every refresh-token session for the user
* clears both auth cookies from the browser

### Active session list

`GET /auth/sessions`

Returns the list of active refresh sessions for the user, including:

* session id
* IP address
* user agent
* last used time
* created time

### Revoke one session

`DELETE /auth/sessions/:sessionId`

Deletes one active refresh session by id.

## Google OAuth

### Flow

1. The client opens `GET /auth/google`.
2. Google redirects back to `GET /auth/google/callback`.
3. Passport validates the Google profile.
4. The service finds or creates the local user record.
5. A new session is issued and auth cookies are set.
6. The browser is redirected to the frontend application.

### Notes

* If the email already exists as a local/password account, the login is rejected to avoid account collisions.
* Google users are marked as verified because Google has already confirmed the email.

## Response Format

Most auth endpoints use the standard response envelope:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Errors use the same envelope without `data`.
