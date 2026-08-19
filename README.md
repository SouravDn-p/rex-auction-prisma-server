# Rex Auction Server

A high-performance, production-ready Node.js and Express API featuring strict **TypeScript** verification, **Prisma ORM** database integration, Redis-backed session handling, and secure cookie-based JWT authentication.

---

## 🚀 Key Features

*   Modular MVC-style architecture with controllers, services, DTOs, and shared guards/utilities.
*   Secure auth flow with short-lived access tokens, rotating refresh tokens, and HTTP-only cookies.
*   Prisma + PostgreSQL persistence with token/session tracking in the database.
*   Joi validation, centralized error handling, and consistent success/error response envelopes.
*   Security middleware including `helmet`, `cors`, `hpp`, and rate limiting.
*   Swagger UI documentation for the API surface.

---

## 🛠️ Technology Stack

*   Node.js, Express.js 5, and TypeScript
*   PostgreSQL with Prisma Client
*   JWT, bcryptjs, cookie-parser, Passport Google OAuth
*   Joi, Swagger UI, and Swagger JSDoc
*   Redis for cache/session support and BullMQ for background jobs

---

## 📁 Project Structure

```text
rex-auction-server/
├── prisma/
│   └── schema.prisma          # Database schema models
├── src/
│   ├── app/
│   │   ├── common/            # Shared utilities, guards, middleware, constants
│   │   └── modules/           # Feature modules such as auth, users, auctions, etc.
│   ├── config/                # Environment, database, Redis, Swagger, Passport
│   ├── services/             # Reusable services and templates
│   ├── types/                 # Custom TypeScript declarations
│   ├── app.ts                 # Express application bootstrap
│   └── main.ts                # Server entry point
├── docs/
│   └── auth/                  # Authentication documentation
├── docker-compose.yml         # Local Redis stack
├── package.json
└── README.md
```

---

## ⚙️ Setup After Clone

### Prerequisites

You need:

* Node.js 18+
* npm
* PostgreSQL
* Redis

The app also expects a configured email provider, JWT secrets, and OAuth secrets for the optional Google login flow.

### Clone and install

```bash
git clone <repo-url>
cd rex-auction-prisma-server
npm install
```

### Environment variables

Create a `.env` file in the project root. A typical local setup looks like this:

```ini
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
DATABASE_URL="postgresql://user:password@localhost:5432/rex_auction"
REDIS_URL="redis://localhost:6379"
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
SESSION_SECRET="replace-with-a-long-random-string"
JWT_ACCESS_SECRET="replace-with-a-long-random-string"
JWT_REFRESH_SECRET="replace-with-a-long-random-string"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OTP_EXPIRES_MIN=10
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL=""
BREVO_API_KEY=""
MAIL_FROM="no-reply@example.com"
MAIL_FROM_NAME="Rex Auction"
SSLCOMMERZ_STORE_ID=""
SSLCOMMERZ_STORE_PASSWORD=""
SSLCOMMERZ_IS_LIVE=false
PLATFORM_FEE_PERCENT=20
```

### Database setup without Docker

If you already have PostgreSQL and Redis running locally or remotely:

```bash
npx prisma generate
npx prisma db push
```

Then start the app:

```bash
npm run dev
```

### Database setup with Docker

The included `docker-compose.yml` starts Redis for local development:

```bash
docker compose up -d
```

After Docker is running:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

### Production build

```bash
npm run build
npm start
```

> [!TIP]
> If you hit file watcher limits on Linux during development, increase the inotify watch limit system-wide.

---

## 🔒 Authentication Docs

The full authentication guide lives in [docs/auth/auth.md](/docs/auth/auth.md). It covers:

* OTP registration verification
* password reset flow
* access token and refresh token rotation
* session storage and device management
* logout and logout-all behavior
* Google OAuth login
* required auth-related environment variables

Service-specific docs live under [docs/services/](./docs/services/README.md).

---

## 📡 API Endpoints & Swagger Documentation

### Swagger UI API Explorer
Once the server is running, the interactive Swagger UI is available at:
👉 **[http://localhost:5000/api/docs](http://localhost:5000/api/docs)**

---

### Core Auth Endpoints

| Endpoint | HTTP Method | Auth Required | Description | Request Body / Cookies |
| :--- | :---: | :---: | :--- | :--- |
| **/auth/register** | `POST` | ❌ No | Creates a new user account and sends an OTP for email verification. | **Body**: `{ name, email, password }` |
| **/auth/verify-email** | `POST` | ❌ No | Verifies the OTP, marks the email as verified, and opens a session. | **Body**: `{ email, otp }`<br>**Sets Cookies**: `accessToken`, `refreshToken` |
| **/auth/resend-otp** | `POST` | ❌ No | Resends the verification OTP with throttling. | **Body**: `{ email }` |
| **/auth/forgot-password** | `POST` | ❌ No | Sends a password reset OTP for active accounts. | **Body**: `{ email }` |
| **/auth/reset-password** | `POST` | ❌ No | Verifies the reset OTP and updates the password. | **Body**: `{ email, otp, newPassword }` |
| **/auth/login** | `POST` | ❌ No | Authenticates credentials and creates a session. | **Body**: `{ email, password }`<br>**Sets Cookies**: `accessToken`, `refreshToken` |
| **/auth/google** | `GET` | ❌ No | Initiates the Google OAuth consent flow. | **Redirects** to Google |
| **/auth/google/callback** | `GET` | ❌ No | Google OAuth callback URL. Generates/Updates user and redirect to frontend dashboard. | **Sets Cookies**: `accessToken`, `refreshToken` |
| **/auth/logout** | `POST` | 🔑 Yes | Revokes the current session refresh token in PostgreSQL and clears cookies on the client side. | **Headers**: `Authorization: Bearer <token>` OR **Cookies**: `accessToken` |
| **/auth/logout-all** | `POST` | 🔑 Yes | Revokes every refresh token session for the user. | **Headers**: `Authorization: Bearer <token>` OR **Cookies**: `accessToken` |
| **/auth/sessions** | `GET` | 🔑 Yes | Lists active device sessions for the current user. | **Headers**: `Authorization: Bearer <token>` OR **Cookies**: `accessToken` |
| **/auth/sessions/:sessionId** | `DELETE` | 🔑 Yes | Revokes one active session by session id. | **Headers**: `Authorization: Bearer <token>` OR **Cookies**: `accessToken` |
| **/auth/refresh-token** | `POST` | ❌ No | Rotates the refresh token session and issues a fresh set of authentication tokens. | **Cookies**: `refreshToken` OR **Body**: `{ refreshToken }`<br>**Sets Cookies**: `accessToken`, `refreshToken` (rotated) |
| **/auth/me** | `GET` | 🔑 Yes | Returns the profile data of the currently logged-in user. | **Headers**: `Authorization: Bearer <token>` OR **Cookies**: `accessToken` |

---

## 🎨 Unified API Response Schemas

### Success Structure
```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "user": {
      "id": "ckv1abcde0000xxxx",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2026-05-21T03:45:00.000Z",
      "updatedAt": "2026-05-21T03:45:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Error Structure
```json
{
  "success": false,
  "message": "An account with this email already exists"
}
```

---

## 🛡️ License

This project is licensed under the ISC License.
