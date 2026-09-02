# Rex Auction Server

A production-oriented Node.js + Express + TypeScript API for a real-time online auction platform. It combines a REST API, a Socket.IO real-time layer (live bidding, chat, notifications), Prisma/PostgreSQL persistence, Redis-backed caching/locking/pub-sub state, BullMQ background jobs, Cloudinary media storage, Brevo transactional email, and an SSLCommerz payment gateway integration with an automatic 80/20 seller/platform payout split.

---

## Table of Contents

- [Key Features](#-key-features)
- [Technology Stack](#️-technology-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Setup After Clone](#️-setup-after-clone)
- [Build From Scratch](#-build-from-scratch)
- [Environment Variables Reference](#-environment-variables-reference)
- [API Overview](#-api-overview)
- [Real-Time Layer (Socket.IO)](#-real-time-layer-socketio)
- [Background Jobs (BullMQ)](#-background-jobs-bullmq)
- [Payments (SSLCommerz)](#-payments-sslcommerz)
- [Unified API Response Schemas](#-unified-api-response-schemas)
- [Error Handling](#-error-handling)
- [Documentation Index](#-documentation-index)
- [Known Gaps & Notes for Contributors](#-known-gaps--notes-for-contributors)
- [Suggestions to Harden This Project](#-suggestions-to-harden-this-project)
- [License](#️-license)

---

## 🚀 Key Features

* Modular MVC-style architecture: every feature module ships `*.routes.ts` → `*.controller.ts` → `*.service.ts`, plus Joi DTOs and Swagger path docs.
* Secure auth flow with short-lived access tokens, rotating refresh tokens stored server-side, and HTTP-only cookies (see [docs/auth/auth.md](./docs/auth/auth.md)).
* Real-time bidding engine with proxy/auto-bid resolution, per-auction Redis locking, and Socket.IO broadcast — see [Real-Time Layer](#-real-time-layer-socketio).
* Auction lifecycle automation: BullMQ schedules `start-auction`/`end-auction` jobs at the exact `startTime`/`endTime` the seller picked, no polling.
* SSLCommerz payment gateway with IPN-driven settlement, idempotent webhook handling, and an automatic 80% seller / 20% platform payout split.
* Prisma + PostgreSQL persistence (Prisma 7, `@prisma/adapter-pg` driver adapter, Neon-compatible).
* Joi validation (JSON and multipart), centralized error handling, and a consistent `{ success, message, data }` response envelope.
* Security middleware: `helmet`, `cors` (credentialed, allow-listed origins), `hpp`, tiered rate limiting (global + stricter auth limiter).
* Cloudinary-backed media uploads for auction images, blog images, and announcement banners.
* Swagger/OpenAPI UI for the full API surface.

---

## 🛠️ Technology Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js (ESM, `"type": "module"`), TypeScript 6, executed directly via `tsx` |
| Web framework | Express 5 |
| Database / ORM | PostgreSQL, Prisma 7 Client with `@prisma/adapter-pg` (driver adapter, works with Neon) |
| Cache / locks / pub-sub state | Redis (`ioredis`) — auth cache, bidding locks, chat presence, payment idempotency |
| Background jobs | BullMQ (`email-queue`, `auction-queue`, `token-cleanup-queue`) |
| Real-time | Socket.IO, namespaced: `/auction`, `/chat`, `/notifications` |
| Auth | JWT (`jsonwebtoken`), `bcryptjs`, `cookie-parser`, Passport Google OAuth 2.0 |
| Validation | Joi (JSON body + multipart form DTOs) |
| File storage | Cloudinary (`multer` memory storage → Cloudinary upload) |
| Email | Brevo transactional email API |
| Payments | `sslcommerz-lts` (SSLCommerz gateway) |
| Docs | `swagger-jsdoc` + `swagger-ui-express`, served at `/api/docs` |
| Logging | Winston (colorized dev console incl. Prisma query logging, JSON file logs in production) |
| Precision math | `decimal.js` for all money math (bids, fees, balances) |

---

## 🏛️ Architecture

### Request lifecycle

```
Client
  │
  ▼
helmet → cors → rateLimit (100/15min, skips payment callbacks)
  → passport.initialize() → express.json/urlencoded → cookie-parser → hpp()
  │
  ▼
/api/docs (Swagger UI)      /api/v1/<module>  (authLimiter only on /auth)
  │                                │
  │                                ▼
  │                         module.routes.ts
  │                                │  protect / optionalProtect / restrictTo(role)
  │                                │  validateDto(schema) / validateFormDto(schema)
  │                                │  upload.single|array (multer, in-memory)
  │                                ▼
  │                         module.controller.ts  (parse req → call service → sendSuccess)
  │                                │
  │                                ▼
  │                         module.service.ts  (Prisma / Redis / BullMQ / Socket.IO)
  │                                │
  ▼                                ▼
errorHandler (last middleware)   PostgreSQL / Redis / Cloudinary / Brevo / SSLCommerz
```

Every module follows the same three-file pattern. Controllers stay thin (`try { ...; sendSuccess(res, ...) } catch (e) { next(e) }`); all business logic — including cross-cutting effects like cache invalidation, queue enqueue, and socket emits — lives in the service layer.

### Single process, one port

`src/main.ts` boots everything on one HTTP server and one port (`ENV.PORT`, default `5000`):

```ts
const startServer = async (): Promise<void> => {
  await connectDatabase();
  const app = CreateApp();
  const server = app.listen(ENV.PORT, () => { /* ... */ });
  initSocketIO(server);   // Socket.IO upgrades on the same HTTP server
  await initWorkers();    // registers BullMQ workers + the daily token-cleanup cron
};
```

REST (`/api/v1/*`), Swagger UI (`/api/docs`), and Socket.IO all share this one server/port — there is no separate WebSocket port. Graceful shutdown is wired for `SIGTERM`/`SIGINT` (closes the HTTP server, disconnects Prisma, 10s forced-shutdown timeout) and `unhandledRejection`; `uncaughtException` exits immediately without cleanup.

---

## 📁 Project Structure

```text
rex-auction-server/
├── prisma/
│   ├── schema.prisma           # Full data model (users, auctions, bidding, payments, chat, content, admin)
│   └── migrations/             # Timestamped SQL migrations
├── src/
│   ├── app.ts                  # Express app factory: middleware chain + route mounting
│   ├── main.ts                 # Process entry point: DB connect → HTTP server → sockets → workers
│   ├── app/
│   │   ├── common/
│   │   │   ├── constants/      # HTTP status codes, message strings
│   │   │   ├── exceptions/     # AppError class, global error handler, XSS middleware (currently unused, see below)
│   │   │   ├── guards/         # protect / restrictTo / optionalProtect, DTO validation middleware
│   │   │   ├── interceptors/   # sendSuccess response helper
│   │   │   ├── interfaces/     # Shared TS interfaces (e.g. email job payloads)
│   │   │   ├── jobs/           # BullMQ worker processors + repeatable-job scheduler
│   │   │   ├── middlewares/    # multer upload config
│   │   │   └── utils/          # jwt, cookies, OTP, logger, mailer, uploads, invoices
│   │   └── modules/            # One folder per feature: announcements, auctions, auth,
│   │                            # bidding, blog, chat, payments, users
│   │                            # each with *.routes.ts / *.controller.ts / *.service.ts /
│   │                            # dto/ (Joi schemas) / doc/ (Swagger paths)
│   ├── config/                 # env, db (Prisma+pg adapter), redis, bull queues, cloudinary,
│   │                            # passport (Google OAuth), swagger
│   ├── services/
│   │   ├── sockets/            # Socket.IO server + /auction, /chat, /notifications namespaces
│   │   ├── cloudinary/         # Cloudinary upload service wrapper
│   │   └── templates/          # HTML email templates (OTP, password reset, welcome)
│   └── types/                  # Ambient/custom TypeScript declarations
├── docs/
│   ├── auth/auth.md            # Full authentication & session guide
│   ├── api-reference.md        # Full REST endpoint reference for every non-auth module
│   └── services/               # Brevo, BullMQ, Cloudinary, Redis, Socket.IO, Payments deep-dives
├── docker-compose.yml           # Local Redis only (Postgres is expected to run elsewhere, e.g. Neon)
├── package.json
└── README.md
```

---

## ⚙️ Setup After Clone

### Prerequisites

* Node.js 18+
* npm
* PostgreSQL (a Neon connection string works out of the box — Prisma logs `PostgreSQL (NeonDB) connected via Prisma`)
* Redis
* Accounts/keys for: Brevo (email), SSLCommerz (payments), Cloudinary (media), Google OAuth (optional social login)

### Clone and install

```bash
git clone <repo-url>
cd rex-auction-prisma-server
npm install
```

### Environment variables

Create a `.env` file in the project root. See [Environment Variables Reference](#-environment-variables-reference) below for the full list, required vs. optional. A working local setup looks like this:

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

CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

### Database setup without Docker

If PostgreSQL and Redis are already running locally or remotely:

```bash
npx prisma generate
npx prisma db push
```

Then start the app:

```bash
npm run dev
```

### Database setup with Docker

The included `docker-compose.yml` only starts **Redis** for local development (Postgres is not containerized — point `DATABASE_URL` at a local install or a hosted instance such as Neon):

```bash
docker compose up -d
```

After Redis is running:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

### Scripts

```bash
npm run dev            # nodemon + tsx, watches src/**/*.ts
npm run start          # tsx src/main.ts (runs TS directly, no compile step)
npm run build          # tsc — compiles to JS (not currently wired into `start`; see Known Gaps)
npm run format          # prettier --write .
npm run format:check    # prettier --check .
```

> [!NOTE]
> There is currently no `test` script (npm test is a stub), no ESLint config, and no CI workflow. See [Known Gaps & Notes for Contributors](#-known-gaps--notes-for-contributors).

> [!TIP]
> If you hit file watcher limits on Linux during development, increase the inotify watch limit system-wide.

---

## 🧱 Build From Scratch

If you want to **rebuild this server from an empty folder** (Node install → `npm init` → dependencies one by one → folder tree → bare Express → Prisma → auth → users), not clone-and-run, use:

**[docs/from-scratch.md](./docs/from-scratch.md)**

That guide stops after the two modules everything else sits on (`auth` + `users`). Auctions, bidding, payments, and sockets are the same module pattern repeated after that skeleton boots.

---

## 🔑 Environment Variables Reference

Parsed and validated in [`src/config/env.config.ts`](./src/config/env.config.ts).

### Required (the process throws at startup if missing)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (used by the Prisma `pg` adapter) |
| `FRONTEND_URL` | Used for OAuth/payment redirect targets |
| `BACKEND_URL` | Used for building absolute callback URLs (e.g. Google OAuth) |
| `JWT_ACCESS_SECRET` | Signs/verifies access tokens |
| `JWT_REFRESH_SECRET` | Signs/verifies refresh tokens |
| `SESSION_SECRET` | Passport/session-adjacent secret |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `MAIL_FROM` | Sender address for all outbound email |
| `SSLCOMMERZ_STORE_ID` | SSLCommerz merchant store ID |
| `SSLCOMMERZ_STORE_PASSWORD` | SSLCommerz merchant store password |

### Optional (defaulted or not validated)

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | Controls Winston format, cookie `secure` flag, error-message verbosity |
| `PORT` | `5000` | Single port for REST + Swagger + Socket.IO |
| `ALLOWED_ORIGINS` | `""` (empty) | Comma-separated CORS allow-list |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Must stay in sync with `REFRESH_TOKEN_TTL_MS` — see [Known Gaps](#-known-gaps--notes-for-contributors) |
| `OTP_EXPIRES_MIN` | `10` | |
| `MAIL_FROM_NAME` | `Rex Auction` | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | `""` | Google login is inert until these are set |
| `REDIS_URL` | *(unset → runtime error, not startup)* | Read with a non-null assertion (`!`), not wrapped in the `required()` check — see [Known Gaps](#-known-gaps--notes-for-contributors) |
| `SSLCOMMERZ_IS_LIVE` | `false` | Sandbox vs. live SSLCommerz endpoint |
| `PLATFORM_FEE_PERCENT` | `20` | Platform's cut of every settled payment (see [Payments](#-payments-sslcommerz)) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | — | Read directly via `process.env` in `src/config/cloudinary/cloudinary.ts`, **not** through `env.config.ts` — unvalidated at startup |

---

## 📡 API Overview

Base path: `/api/v1`. Interactive Swagger UI: **`http://localhost:5000/api/docs`** (cookie-based `accessToken` auth wired in).

| Module | Base path | Docs |
| --- | --- | --- |
| Auth | `/api/v1/auth` | [docs/auth/auth.md](./docs/auth/auth.md) |
| Users | `/api/v1/users` | [docs/api-reference.md#users](./docs/api-reference.md#users) |
| Auctions | `/api/v1/auctions` | [docs/api-reference.md#auctions](./docs/api-reference.md#auctions) |
| Bidding | `/api/v1/bidding` | [docs/api-reference.md#bidding](./docs/api-reference.md#bidding) |
| Blog | `/api/v1/blogs` | [docs/api-reference.md#blog](./docs/api-reference.md#blog) |
| Announcements | `/api/v1/announcements` | [docs/api-reference.md#announcements](./docs/api-reference.md#announcements) |
| Chat | `/api/v1/chat` | [docs/api-reference.md#chat](./docs/api-reference.md#chat) |
| Payments | `/api/v1/payments` | [docs/services/payments.md](./docs/services/payments.md) |

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
| **/auth/google/callback** | `GET` | ❌ No | Google OAuth callback URL. Generates/updates user and redirects to frontend dashboard. | **Sets Cookies**: `accessToken`, `refreshToken` |
| **/auth/logout** | `POST` | 🔑 Yes | Revokes the current session refresh token and clears cookies. | **Cookies**: `accessToken` |
| **/auth/logout-all** | `POST` | 🔑 Yes | Revokes every refresh-token session for the user. | **Cookies**: `accessToken` |
| **/auth/sessions** | `GET` | 🔑 Yes | Lists active device sessions for the current user. | **Cookies**: `accessToken` |
| **/auth/sessions/:sessionId** | `DELETE` | 🔑 Yes | Revokes one active session by session id. | **Cookies**: `accessToken` |
| **/auth/refresh-token** | `POST` | ❌ No | Rotates the refresh token session and issues a fresh token pair. | **Cookies**: `refreshToken`<br>**Sets Cookies**: `accessToken`, `refreshToken` (rotated) |
| **/auth/me** | `GET` | 🔑 Yes | Returns the profile of the currently logged-in user. | **Cookies**: `accessToken` |

Full request/response detail for every other module (Users, Auctions, Bidding, Blog, Announcements, Chat) lives in **[docs/api-reference.md](./docs/api-reference.md)** — it was pulled directly from each module's routes/DTOs and is kept as a single source of truth rather than duplicated here.

### Auth guard reference

| Middleware | File | Behavior |
| --- | --- | --- |
| `protect` | `src/app/common/guards/auth.middleware.ts` | Reads `accessToken` cookie, verifies JWT, resolves the user via a 60s Redis cache (`user:auth:{id}`) falling back to Prisma, attaches `req.user`. Used on every protected route across all modules. |
| `restrictTo(...roles)` | same file | Role gate (`USER`/`SELLER`/`ADMIN`), must run after `protect`. |
| `optionalProtect` | same file | Same as `protect` but never rejects — attaches `req.user` if present, otherwise continues anonymously. Used for endpoints that add admin/author-only fields to an otherwise-public response (e.g. announcement/blog listings). |
| `authenticate` | `src/app/common/guards/authenticate.middleware.ts` | A separate, simpler guard used **only inside the auth module itself** — trusts the decoded JWT payload directly without the Redis/DB lookup `protect` does. Not used by any other module's router. |
| `validateDto(schema)` | `src/app/common/guards/validate-dto.middleware.ts` | Joi validation for JSON bodies. |
| `validateFormDto(schema)` | same file | Joi validation for multipart form bodies — coerces stringified `tags`/`isActive` fields before validating. |

---

## 🔴 Real-Time Layer (Socket.IO)

Full detail: **[docs/services/sockets.md](./docs/services/sockets.md)**.

Three namespaces are mounted on the same server/port as the REST API, each behind a JWT socket-auth middleware that reuses the same `user:auth:{id}` Redis cache as `protect`:

| Namespace | Purpose | Key client events | Key server events |
| --- | --- | --- | --- |
| `/auction` | Live bidding | `auction:join`, `auction:leave`, `bid:place`, `autobid:set`, `autobid:cancel` | `bid:update`, `bid:error`, `auction:started`, `auction:ended` |
| `/chat` | Direct messaging | `chat:join`, `chat:send`, `chat:typing` | `chat:message`, `chat:typing` |
| `/notifications` | Cross-cutting push notifications | *(none — join-on-connect only)* | `notification:new` |

The bidding engine ([`src/app/modules/bidding/bidding.service.ts`](./src/app/modules/bidding/bidding.service.ts)) is shared by both the REST endpoints and the `/auction` socket handlers, so a bid placed over HTTP and a bid placed over a socket go through identical validation, locking, and auto-bid resolution logic.

### Auto-bid (proxy bidding) resolution

Every manual bid re-runs a proxy-bid chain against all other active auto-bids on the auction, escalating the leader until no other auto-bid can beat them (eBay-style):

```ts
// src/app/modules/bidding/bidding.service.ts
while (true) {
  const candidates = autoBids
    .filter(ab => ab.userId !== leaderId)
    .map(ab => ({ ...ab, nextBid: leaderAmount.plus(ab.incrementStep) }))
    .filter(ab => ab.nextBid.lte(ab.maxBidDec))
    .sort((a, b) => b.maxBidDec.comparedTo(a.maxBidDec));

  const winner = candidates[0];
  if (!winner) break;

  leaderId = winner.userId;
  leaderAmount = winner.nextBid;
  leaderIsAutoBid = true;
}
```

All bid mutations for a given auction run inside a short Redis lock (`SET auction:{id}:lock 1 PX 5000 NX`, retried up to 20× at 50ms) so concurrent bids on the same auction are serialized instead of racing.

---

## ⏱️ Background Jobs (BullMQ)

Full detail: **[docs/services/bullmq.md](./docs/services/bullmq.md)**.

| Queue | Triggered by | Does |
| --- | --- | --- |
| `auction-queue` | `AuctionsService.scheduleTransitions`, enqueued when an admin approves a pending auction, delayed to fire exactly at `startTime`/`endTime` | `start-auction`: flips `upcoming → active`. `end-auction`: computes the winner from the highest `LiveBid`, writes `EndedAuction`/`UserStats`/`UserActivity`/`Notification` in one transaction, emits `auction:ended` + `notification:new` over Socket.IO. |
| `email-queue` | OTP emails (auth), payment invoice/proceeds emails (payments) | Sends transactional email via Brevo. 3 retries, exponential backoff. |
| `token-cleanup-queue` | A daily repeatable job (`0 3 * * *`, registered in `scheduler.ts`) | Deletes expired `UserToken` rows and stale refresh sessions (`lastUsedAt` older than 7 days). |

---

## 💳 Payments (SSLCommerz)

Full detail: **[docs/services/payments.md](./docs/services/payments.md)**.

* A buyer who won an auction calls `GET /payments/initiate/:auctionId`, which redirects to the SSLCommerz gateway page.
* `POST /payments/success|fail|cancel|ipn` are SSLCommerz's callback URLs — they are **exempt from the global rate limiter** in `app.ts` since they're hit by the gateway/browser redirect, not the SPA.
* Real settlement only happens from the **IPN** webhook (`handleIPN`), never from the browser `success` redirect alone — the IPN payload is re-validated against SSLCommerz's Validation API and guarded by a Redis idempotency flag + distributed lock so duplicate/concurrent webhook delivery can't double-credit anyone.
* On confirmed payment, one Prisma transaction marks the `Payment` `PAID`, flips the `Auction` to `sold`, and splits the money:

```ts
// src/app/modules/payments/payments.service.ts
const PLATFORM_FEE = new Decimal(ENV.PLATFORM_FEE_PERCENT).div(100); // 0.20
const computeSplit = (amount: Decimal) => {
  const serviceFee = amount.mul(PLATFORM_FEE).toDecimalPlaces(2);
  const sellerProceeds = amount.minus(serviceFee).toDecimalPlaces(2);
  return { serviceFee, sellerProceeds };
};
```

`Transaction` rows are written for the buyer (`auction_payment`), the seller (`seller_earning`, 80%), and the platform fee (`platform_fee`, negative, on the seller's ledger for audit purposes); the seller's `UserStats.accountBalance` is credited with `sellerProceeds` — this is the only place a seller's spendable balance actually changes.

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
      "role": "USER",
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

Built with `sendSuccess()` (`src/app/common/interceptors/response.util.ts`) on the success path, and the global `errorHandler` on the failure path — see below.

---

## 🧯 Error Handling

`AppError` (`src/app/common/exceptions/app-error.exception.ts`) is the operational error type thrown throughout services:

```ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}
```

The last middleware in `app.ts`, `errorHandler` (`src/app/common/exceptions/error-handler.exeption.ts`), maps errors to responses:

| Error type | Response |
| --- | --- |
| `AppError` | `err.statusCode` with `err.message` |
| Prisma `P2002` (unique violation) | `409` `"{field} already exists"` |
| Prisma `P2025` (not found) | `404` `"Record not found"` |
| Prisma `P2003` (FK violation) | `400` `"Related record not found"` |
| `PrismaClientValidationError` | `400` |
| `PrismaClientInitializationError` | `500` `"Database connection failed"` |
| `JsonWebTokenError` / `TokenExpiredError` | `401` `"Invalid or expired token"` |
| Anything else | `500`, message/stack hidden when `NODE_ENV=production` |

---

## 📚 Documentation Index

| Doc | Covers |
| --- | --- |
| [docs/from-scratch.md](./docs/from-scratch.md) | Rebuild from an empty folder: Node, deps, folder tree, bare server, Prisma, auth + users |
| [docs/auth/auth.md](./docs/auth/auth.md) | Registration/OTP, login, password reset, JWT rotation, sessions, Google OAuth |
| [docs/api-reference.md](./docs/api-reference.md) | Full endpoint reference for Users, Auctions, Bidding, Blog, Announcements, Chat |
| [docs/services/sockets.md](./docs/services/sockets.md) | Socket.IO namespaces, events, and payloads |
| [docs/services/bullmq.md](./docs/services/bullmq.md) | Queues, workers, retry policy, the daily cron job |
| [docs/services/payments.md](./docs/services/payments.md) | SSLCommerz integration, IPN handling, fee split, invoices |
| [docs/services/redis.md](./docs/services/redis.md) | Auth cache, bidding locks, chat presence, payment idempotency keys |
| [docs/services/cloudinary.md](./docs/services/cloudinary.md) | Media upload pipeline |
| [docs/services/brevo.md](./docs/services/brevo.md) | Transactional email delivery |

---

## ⚠️ Known Gaps & Notes for Contributors

These were found while documenting the codebase and are worth knowing before you build on top of it:

* **`xss.middleware.ts` is dead code.** It's fully implemented (recursively sanitizes every string in `req.body`) but never imported into `app.ts`'s middleware chain — request bodies are **not** currently XSS-sanitized. Either wire it in or remove it.
* **Two auth guards exist.** `protect` (`auth.middleware.ts`) is the real, cache-backed guard used everywhere. `authenticate` (`authenticate.middleware.ts`) is a simpler guard that trusts the JWT payload without a DB/cache lookup, and is only used inside the auth module itself — don't reach for it in new modules.
* **`REDIS_URL` isn't validated at startup.** Every other required secret throws immediately via `env.config.ts`'s `required()` helper; `REDIS_URL` is read with a non-null assertion instead, so a missing value fails later at first Redis use, not at boot.
* **Cloudinary env vars bypass `env.config.ts`.** `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` are read directly via `process.env` in `src/config/cloudinary/cloudinary.ts`, so they're unvalidated and won't produce a clear startup error if missing.
* **`JWT_REFRESH_EXPIRES_IN` and `REFRESH_TOKEN_TTL_MS` must be kept in sync manually** — one drives JWT expiry, the other (hardcoded in ms) drives cookie/session TTL bookkeeping.
* **REST chat doesn't push live.** `POST /chat/messages` persists a message but only the Socket.IO `chat:send` handler broadcasts `chat:message`/`notification:new`. A client that only uses REST won't see messages arrive in real time.
* **`npm run build` (tsc) isn't wired into `npm start`.** `start` runs `tsx src/main.ts` directly against TypeScript source; it's unclear whether the compiled `build` output is used anywhere (e.g. a production Dockerfile). Confirm your deploy target before relying on `build`.

---

## 🌟 Suggestions to Harden This Project

Not implemented — flagged for prioritization:

1. **Automated tests.** No test framework is configured at all (`npm test` is a stub). Start with integration tests for auth, bidding concurrency, and payment settlement (the highest-risk money/race-condition paths), using something like Vitest + Supertest + a disposable Postgres/Redis (Testcontainers or Docker Compose).
2. **CI pipeline.** No `.github/workflows` exists. A minimal pipeline (typecheck, lint, `prisma validate`, tests) on every PR would catch regressions before merge.
3. **Linting.** No ESLint config exists — only Prettier. Add `typescript-eslint` with rules for unused vars/floating promises (relevant here given several fire-and-forget `.catch(() => {})` calls) and hook it into `format:check`/CI.
4. **Fix or remove the XSS middleware gap** noted above — it's the one security control in the repo that looks wired in but isn't.
5. **Containerize the app itself.** There's a `docker-compose.yml` for Redis but no `Dockerfile` for the API — add one (multi-stage build using the existing `tsc` output) so `docker compose up` can bring up the whole stack, and so deploys aren't tied to a specific host's Node install.
6. **Structured observability.** Winston logs to files/console only. Consider request-id correlation (a middleware that stamps each request/error log line) and shipping logs/metrics to something queryable in production, plus error tracking (e.g. Sentry) for uncaught exceptions.
7. **Centralize env validation.** Move the Cloudinary vars into `env.config.ts`'s `required()`/defaulting pattern so every external dependency fails fast and consistently at boot.
8. **API versioning discipline.** Routes are already under `/api/v1`, which is good — document the deprecation/versioning policy before a `v2` is ever needed.
9. **Rate limit the Socket.IO layer**, not just REST — `bid:place`/`chat:send` currently have no per-socket throttle, so a misbehaving client could spam either namespace.
10. **Health/readiness endpoints.** The only "health check" today is `GET /` returning static text. A `/healthz` that checks DB + Redis connectivity makes this deployable behind a load balancer/orchestrator with real liveness/readiness probes.

---

## 🛡️ License

This project is licensed under the ISC License.
