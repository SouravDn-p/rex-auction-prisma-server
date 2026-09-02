# From Scratch: Rex Auction Server (Auth + Users)

This is not a clone-and-run guide. It is a rebuild of **this repository's architecture**, started from an empty folder, stopped after the two modules every other feature depends on: **auth** and **users**.

When you finish, you have:

- Node + TypeScript ESM, run with `tsx` (no compile step in development)
- Express 5 with a real middleware stack
- Prisma 7 + PostgreSQL (driver adapter)
- Redis (auth cache) + BullMQ (OTP emails + token cleanup)
- Cookie-based JWT sessions with rotation
- `POST /api/v1/auth/*` and `GET|PATCH /api/v1/users/*`

Everything else in this repo (auctions, bidding, payments, sockets, Cloudinary) is the **same module pattern** repeated. Do not add those until this skeleton boots and you can register → verify OTP → login → call `GET /users/me`.

Full production auth detail lives in [auth.md](./auth/auth.md). This document is the **build order**.

---

## Table of contents

1. [What you are actually building](#1-what-you-are-actually-building)
2. [Prerequisites](#2-prerequisites)
3. [Phase 0 — empty project](#3-phase-0--empty-project)
4. [Phase 1 — TypeScript + ESM](#4-phase-1--typescript--esm)
5. [Phase 2 — folder skeleton (no code yet)](#5-phase-2--folder-skeleton-no-code-yet)
6. [Phase 3 — first server, zero APIs](#6-phase-3--first-server-zero-apis)
7. [Phase 4 — environment config](#7-phase-4--environment-config)
8. [Phase 5 — common layer](#8-phase-5--common-layer)
9. [Phase 6 — security middleware on the empty server](#9-phase-6--security-middleware-on-the-empty-server)
10. [Phase 7 — Prisma (users + tokens only)](#10-phase-7--prisma-users--tokens-only)
11. [Phase 8 — Redis, mail, queues](#11-phase-8--redis-mail-queues)
12. [Phase 9 — auth primitives (JWT, cookies, OTP)](#12-phase-9--auth-primitives-jwt-cookies-otp)
13. [Phase 10 — guards](#13-phase-10--guards)
14. [Phase 11 — auth module](#14-phase-11--auth-module)
15. [Phase 12 — users module](#15-phase-12--users-module)
16. [Phase 13 — wire modules + Swagger + workers](#16-phase-13--wire-modules--swagger--workers)
17. [How auth works (end to end)](#17-how-auth-works-end-to-end)
18. [How a request actually moves](#18-how-a-request-actually-moves)
19. [Verify it](#19-verify-it)
20. [What you are not building yet](#20-what-you-are-not-building-yet)

---

## 1. What you are actually building

One HTTP process, one port (`5000`). REST under `/api/v1`. Swagger at `/api/docs`. Background workers in the same process.

```
Client
  │
  ▼
helmet → cors → rateLimit → passport.initialize()
  → express.json → cookie-parser → hpp
  │
  ▼
/api/docs          /api/v1/auth          /api/v1/users
                      │                      │
                      ▼                      ▼
                 auth.routes            users.routes
                      │                      │
              validateDto / protect    protect / restrictTo
                      │                      │
                 auth.controller        users.controller
                      │                      │
                 auth.service           users.service
                      │                      │
                      ▼                      ▼
              Prisma / Redis / BullMQ / Brevo
                      │
                      ▼
              errorHandler (last middleware)
```

**Hard rules this repo uses — copy them, do not invent a second style:**

| Rule | Why |
| --- | --- |
| Every feature lives in `src/app/modules/<name>/` | routes → controller → service → dto → swagger |
| Controllers stay thin | parse `req` → call service → `sendSuccess` → `catch { next(e) }` |
| Business logic never sits in a controller | Prisma, Redis, JWT, email enqueue all live in the service |
| Throw `AppError(message, statusCode)` for expected failures | the global `errorHandler` turns them into `{ success: false, message }` |
| Protect routes with `protect` from `auth.middleware.ts` | not the legacy `authenticate` guard |
| Money later uses `decimal.js` | not needed until payments exist |

Auth **creates** the user. Users **owns** the profile after login. Do not put `PATCH /me` inside the auth module.

---

## 2. Prerequisites

Install these **before** any npm command.

### Node.js 18+

This project is ESM (`"type": "module"`) and uses native `fetch` for Brevo. Node 20 LTS is the practical target.

```bash
node -v   # v18.x or higher
npm -v
```

On Ubuntu / Debian:

```bash
# nvm is the least painful way to stay current
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# reopen the shell, then:
nvm install 20
nvm use 20
```

### PostgreSQL

A local install or a hosted instance (Neon works; the Prisma connect log even says `PostgreSQL (NeonDB)`). You need a database URL, not Docker-for-Postgres in this repo — `docker-compose.yml` only starts Redis.

```bash
# example local database
createdb rex_auction
```

### Redis

Required for:

- `user:auth:{userId}` cache inside `protect` (60s TTL)
- BullMQ connection (email queue + daily token cleanup)

```bash
docker compose up -d   # from this repo: Redis on :6379
# or: sudo apt install redis-server && sudo systemctl start redis
```

### Accounts you will need for auth to be real

| Service | Used for | Can stub locally? |
| --- | --- | --- |
| Brevo | OTP + welcome + password-reset email | Yes — queue still enqueues; send fails until `BREVO_API_KEY` is valid |
| Google Cloud OAuth | `GET /auth/google` | Yes — leave client id/secret empty; local login still works |

You do **not** need Cloudinary, SSLCommerz, or Socket.IO for this skeleton.

---

## 3. Phase 0 — empty project

```bash
mkdir rex-auction-server
cd rex-auction-server
npm init -y
```

That writes `package.json`. Immediately make it ESM and add scripts. `"type": "module"` is not optional — without it, Node treats files as CommonJS and the `.ts` import style this repo uses will fail.

```json
{
  "name": "rex-auction-server",
  "version": "1.0.0",
  "description": "Rex Auction API — auth + users skeleton",
  "main": "src/main.ts",
  "type": "module",
  "scripts": {
    "dev": "nodemon --watch src -e ts --exec tsx src/main.ts",
    "start": "tsx src/main.ts",
    "build": "tsc",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "license": "ISC"
}
```

Create `.gitignore` **before** installing anything so `node_modules` and `.env` never get committed:

```gitignore
node_modules/
.env
.env.*
!.env.example
dist/
build/
logs/
*.log
.DS_Store
```

---

## 4. Phase 1 — TypeScript + ESM

Install **one group at a time** so you know what each package is for.

### 1a. Language and runner

```bash
npm i -D typescript tsx nodemon @types/node prettier
```

| Package | Role |
| --- | --- |
| `typescript` | typecheck (`npm run build` → `tsc`). `noEmit: true` in this repo — `start` never runs compiled JS |
| `tsx` | executes TypeScript directly (`tsx src/main.ts`) |
| `nodemon` | restarts `tsx` when `src/**/*.ts` changes |
| `@types/node` | `process`, `crypto`, etc. |
| `prettier` | the only formatter; there is no ESLint in this repo |

`tsconfig.json` — copy this, it matches the real project:

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "types": ["node"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Why `.ts` on every import:** `"module": "NodeNext"` + ESM means import specifiers must include the extension. This repo writes:

```ts
import { ENV } from './config/env.config.ts';
```

not `from './config/env.config'`.

### 1b. HTTP framework

```bash
npm i express
npm i -D @types/express
```

### 1c. Config

```bash
npm i dotenv
```

### 1d. Security middleware (install now, wire in Phase 6)

```bash
npm i helmet cors cookie-parser hpp express-rate-limit
npm i -D @types/cors @types/cookie-parser @types/hpp
```

| Package | Role |
| --- | --- |
| `helmet` | HTTP security headers |
| `cors` | credentialed CORS against `ALLOWED_ORIGINS` |
| `cookie-parser` | read `accessToken` / `refreshToken` cookies |
| `hpp` | HTTP parameter pollution |
| `express-rate-limit` | global limiter + a stricter limiter on `/auth` |

### 1e. Validation + logging

```bash
npm i joi winston
```

Joi validates request bodies. Winston logs (colorized Prisma queries in development).

### 1f. Database

```bash
npm i @prisma/client @prisma/adapter-pg pg
npm i -D prisma
```

Prisma 7 does **not** put the connection string in `schema.prisma`. It uses a driver adapter (`pg` pool → `PrismaPg`). That is why both `@prisma/client` and `@prisma/adapter-pg` exist.

### 1g. Auth crypto

```bash
npm i bcryptjs jsonwebtoken
npm i -D @types/bcryptjs @types/jsonwebtoken
```

| Package | Role |
| --- | --- |
| `bcryptjs` | password hash (cost 12) |
| `jsonwebtoken` | access + refresh JWTs, **two different secrets** |

### 1h. Redis + jobs

```bash
npm i ioredis bullmq
```

`ioredis` is the Redis client. BullMQ uses a **separate** connection object (`maxRetriesPerRequest: null` is required by BullMQ).

### 1i. Google OAuth (auth module)

```bash
npm i passport passport-google-oauth20
npm i -D @types/passport @types/passport-google-oauth20
```

Passport is initialized with **no sessions**. JWT cookies are the session. `express-session` exists in the full `package.json` but is unused for this flow — skip it.

### 1j. API docs

```bash
npm i swagger-jsdoc swagger-ui-express
npm i -D @types/swagger-jsdoc @types/swagger-ui-express
```

Swagger path objects live next to each module (`doc/*.swagger.ts`) and are spread into `src/config/swagger.config.ts`. This project does **not** use JSDoc comments on routes.

---

## 5. Phase 2 — folder skeleton (no code yet)

Create the tree **before** filling files. Empty folders force the mental model.

```text
rex-auction-server/
├── prisma/
│   └── schema.prisma                 # created in Phase 7
├── prisma.config.ts                  # Prisma 7 datasource URL
├── src/
│   ├── main.ts                       # process entry: DB → HTTP → workers
│   ├── app.ts                        # Express factory: middleware + routers
│   ├── types/
│   │   └── express.d.ts              # req.user
│   ├── config/
│   │   ├── env.config.ts
│   │   ├── passport.config.ts
│   │   ├── swagger.config.ts
│   │   ├── db/
│   │   │   └── database.config.ts
│   │   ├── redis/
│   │   │   └── redis.config.ts
│   │   └── bull/
│   │       └── queue.config.ts
│   ├── services/
│   │   └── templates/
│   │       └── email-templates.ts
│   └── app/
│       ├── common/
│       │   ├── constants/            # HTTP_STATUS, MESSAGES
│       │   ├── exceptions/           # AppError, errorHandler
│       │   ├── guards/               # protect, restrictTo, validateDto
│       │   ├── interceptors/         # sendSuccess
│       │   ├── interfaces/           # EmailJobData
│       │   ├── jobs/                 # email worker, token-cleanup, scheduler
│       │   └── utils/                # jwt, cookies, otp, logger, mailer
│       └── modules/
│           ├── auth/
│           │   ├── auth.modules.ts   # re-exports the router
│           │   ├── auth.routes.ts
│           │   ├── auth.controller.ts
│           │   ├── auth.service.ts
│           │   ├── dto/
│           │   ├── doc/
│           │   └── interfaces/
│           └── users/
│               ├── users.modules.ts
│               ├── users.routes.ts
│               ├── users.controller.ts
│               ├── users.service.ts
│               ├── dto/
│               ├── doc/
│               └── interfaces/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

Create it:

```bash
mkdir -p prisma \
  src/types \
  src/config/{db,redis,bull} \
  src/services/templates \
  src/app/common/{constants,exceptions,guards,interceptors,interfaces,jobs,utils} \
  src/app/modules/auth/{dto,doc/paths,interfaces} \
  src/app/modules/users/{dto,doc/paths,interfaces}
```

**Naming this repo uses:**

- `*.modules.ts` is a one-line re-export of the router (`export default authRouter`). `app.ts` imports that file, not `auth.routes.ts` directly, for auth and users.
- `dto/` = Joi schemas (runtime). `interfaces/` = TypeScript types (compile time). They are not the same file.

---

## 6. Phase 3 — first server, zero APIs

Goal: `GET /` returns text. No database. No auth. Confirm TypeScript + `tsx` + nodemon work.

### `src/app.ts`

```ts
import express, { type Application, type Request, type Response } from 'express';

export const CreateApp = (): Application => {
  const app: Application = express();

  app.use(express.json({ limit: '10kb' }));

  app.get('/', (_req: Request, res: Response) => {
    res.send('Welcome to Rex Auction Server');
  });

  return app;
};
```

### `src/main.ts`

```ts
import { CreateApp } from './app.ts';

const startServer = async (): Promise<void> => {
  const app = CreateApp();
  const port = Number(process.env.PORT) || 5000;

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

startServer();
```

Run:

```bash
npm run dev
curl http://localhost:5000
# Welcome to Rex Auction Server
```

If this fails, stop. Do not install Prisma yet — the problem is Node/ESM/`tsx`, not the database.

---

## 7. Phase 4 — environment config

Create `.env` in the project root. For **this skeleton** you only need auth + users + Redis + mail. The full repo also `required()`s SSLCommerz at boot — do not copy that into a two-module starter.

```ini
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rex_auction"
REDIS_URL="redis://localhost:6379"

SESSION_SECRET="replace-with-a-long-random-string"
JWT_ACCESS_SECRET="replace-with-a-long-random-string"
JWT_REFRESH_SECRET="replace-with-a-long-random-string"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OTP_EXPIRES_MIN=10

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

BREVO_API_KEY=
MAIL_FROM="no-reply@example.com"
MAIL_FROM_NAME="Rex Auction"
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that three times for `SESSION_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Never reuse one secret for both JWTs — refresh-token theft would then mint access tokens.

### `src/config/env.config.ts`

```ts
import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  PORT: Number(process.env.PORT) || 5000,

  DATABASE_URL: required('DATABASE_URL'),
  FRONTEND_URL: required('FRONTEND_URL'),
  BACKEND_URL: required('BACKEND_URL'),
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,

  SESSION_SECRET: required('SESSION_SECRET'),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || '',

  BREVO_API_KEY: required('BREVO_API_KEY'),
  MAIL_FROM: required('MAIL_FROM'),
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'Rex Auction',

  REDIS_URL: required('REDIS_URL'),

  OTP_EXPIRES_MIN: Number(process.env.OTP_EXPIRES_MIN) || 10,
};
```

`required()` throws at **import time**. A missing `DATABASE_URL` kills the process before `listen()`. That is intentional.

Keep `JWT_REFRESH_EXPIRES_IN` (`7d`) in sync with `REFRESH_TOKEN_TTL_MS` (7 days in ms). Cookie max-age, JWT expiry, and the `UserToken.expiresAt` row are three clocks; they must agree.

---

## 8. Phase 5 — common layer

These files are shared by **every** future module. Write them once.

### Constants

`src/app/common/constants/http-status.constants.ts` — named numbers (`OK: 200`, `UNAUTHORIZED: 401`, …). Never scatter magic `401`s in services.

`src/app/common/constants/messages.constants.ts` — for this skeleton you only need `MESSAGES.AUTH.*` and `MESSAGES.USER.*`. Copy those two blocks from the real file; leave `AUCTION` / `BID` / `PAYMENT` out until those modules exist.

### Errors

`src/app/common/exceptions/app-error.exception.ts`:

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

Services throw this. Controllers do **not** `res.status(400).json(...)`. They `next(error)` and `errorHandler` formats the envelope.

`src/app/common/exceptions/error-handler.exeption.ts` (filename spelling is historical — keep it if you want drop-in compatibility) must:

1. Map `AppError` → `{ success: false, message }` with `err.statusCode`
2. Map Prisma `P2002` → 409, `P2025` → 404, `P2003` → 400
3. Map `JsonWebTokenError` / `TokenExpiredError` → 401
4. Hide stack traces when `NODE_ENV=production`

Copy the real handler from [`src/app/common/exceptions/error-handler.exeption.ts`](../src/app/common/exceptions/error-handler.exeption.ts).

### Success envelope

`src/app/common/interceptors/response.util.ts`:

```ts
import { type Response } from 'express';

export const sendSuccess = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
  });
};
```

Every successful controller method looks like:

```ts
sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGIN_SUCCESS, { user });
```

Tokens are **not** in `data`. They go in cookies (Phase 9).

### Logger

Copy [`src/app/common/utils/logger.util.ts`](../src/app/common/utils/logger.util.ts). Replace `console.log` in `main.ts` with `logger.info` once this file exists.

### Express `req.user`

`src/types/express.d.ts`:

```ts
/// <reference types="express" />

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      role: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
```

`userId` is a UUID string — that matches `User.id` in `schema.prisma` (`@default(uuid(7)) @db.Uuid`).

### DTO middleware

`src/app/common/guards/validate-dto.middleware.ts` — wrap a Joi schema, `stripUnknown: true`, `abortEarly: false`, replace `req.body` with the validated value, or `next(new AppError(..., 400))`.

Copy [`src/app/common/guards/validate-dto.middleware.ts`](../src/app/common/guards/validate-dto.middleware.ts). You only need `validateDto` for JSON bodies in auth/users. `validateFormDto` exists for later multipart routes (auctions, blogs).

---

## 9. Phase 6 — security middleware on the empty server

Upgrade `CreateApp` **still without feature routers**. You should be able to hit `GET /` with Helmet headers and CORS.

```ts
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { ENV } from './config/env.config.ts';
import { errorHandler } from './app/common/exceptions/error-handler.exeption.ts';

export const CreateApp = (): Application => {
  const app: Application = express();

  app.use(helmet());
  app.use(
    cors({
      origin: ENV.ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests, please try again later' },
    }),
  );

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());
  app.use(hpp());

  app.get('/', (_req: Request, res: Response) => {
    res.send('Welcome to Rex Auction Server');
  });

  app.use(errorHandler);
  return app;
};
```

Order matters:

1. `helmet` / `cors` / `rateLimit` first (before parsing body)
2. `passport.initialize()` later, once Google is wired — **no** `passport.session()`
3. `express.json` then `cookieParser` then `hpp`
4. routers
5. `errorHandler` **last** — four-argument Express error middleware

CORS `credentials: true` is required because auth cookies are HttpOnly. The frontend must call `fetch(..., { credentials: 'include' })`. `allowedHeaders` is only `Content-Type` — there is no `Authorization` header in this design.

---

## 10. Phase 7 — Prisma (users + tokens only)

### Prisma 7 config (not in schema)

`prisma.config.ts` at the repo root:

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
```

### Minimal schema

`prisma/schema.prisma` — **only** what auth + users need. Watchlist is omitted: it foreign-keys `Auction`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  USER
  SELLER
  ADMIN
}

enum AuthProvider {
  local
  google
}

enum TokenType {
  refresh
  emailVerification
  passwordReset
}

enum SellerRequestStatus {
  pending
  approved
  rejected
}

enum ActivityType {
  profile_updated
  seller_request_submitted
}

enum TransactionType {
  deposit
  withdrawal
  auction_payment
  seller_earning
  platform_fee
  refund
}

model User {
  id            String       @id @default(uuid(7)) @db.Uuid
  name          String       @db.VarChar(150)
  email         String       @unique @db.VarChar(255)
  photo         String?
  imagePublicId String?
  cover         String?
  role          UserRole     @default(USER)
  location      String?
  isActive      Boolean      @default(true)
  emailVerified Boolean      @default(false)
  provider      AuthProvider @default(local)
  providerId    String?      @db.VarChar(255)
  password      String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  stats            UserStats?
  activities       UserActivity[]
  transactions     Transaction[]
  sellerRequests   SellerRequest[] @relation("SellerRequestUser")
  reviewedRequests SellerRequest[] @relation("SellerRequestReviewer")
  tokens           UserToken[]

  @@unique([provider, providerId])
  @@index([role])
  @@index([isActive])
  @@map("users")
}

model UserStats {
  id             String   @id @default(uuid(7)) @db.Uuid
  userId         String   @unique @db.Uuid
  accountBalance Decimal  @default(0) @db.Decimal(14, 2)
  auctionsWon    Int      @default(0)
  activeBids     Int      @default(0)
  totalSpent     Decimal  @default(0) @db.Decimal(14, 2)
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@map("user_stats")
}

model UserActivity {
  id           String       @id @default(uuid(7)) @db.Uuid
  userId       String
  activityType ActivityType
  description  String?
  metadata     Json?
  createdAt    DateTime     @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("user_activity")
}

model UserToken {
  id         String    @id @default(uuid(7)) @db.Uuid
  userId     String
  tokenType  TokenType @default(refresh)
  tokenHash  String    @unique @db.VarChar(255)
  deviceInfo Json?
  ipAddress  String?   @db.VarChar(45)
  userAgent  String?
  expiresAt  DateTime
  lastUsedAt DateTime  @default(now())
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, tokenType])
  @@index([expiresAt])
  @@map("user_tokens")
}

model SellerRequest {
  id              String              @id @default(uuid(7)) @db.Uuid
  userId          String
  status          SellerRequestStatus @default(pending)
  businessName    String?             @db.VarChar(255)
  contactPhone    String?             @db.VarChar(50)
  address         String?
  taxId           String?             @db.VarChar(100)
  additionalNotes String?
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime            @default(now())

  user     User  @relation("SellerRequestUser", fields: [userId], references: [id])
  reviewer User? @relation("SellerRequestReviewer", fields: [reviewedBy], references: [id])

  @@index([userId])
  @@index([status])
  @@map("seller_requests")
}

model Transaction {
  id            String          @id @default(uuid(7)) @db.Uuid
  userId        String
  type          TransactionType
  amount        Decimal         @db.Decimal(14, 2)
  referenceType String?         @db.VarChar(50)
  referenceId   String?
  note          String?
  createdAt     DateTime        @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("transactions")
}
```

**Why `UserToken` is one table for three jobs:**

| `tokenType` | What `tokenHash` is | Created by |
| --- | --- | --- |
| `emailVerification` | SHA-256 of the 6-digit OTP | register / resend-otp |
| `passwordReset` | SHA-256 of the 6-digit OTP | forgot-password |
| `refresh` | SHA-256 of the refresh JWT | login / verify-email / Google / refresh rotation |

You never store a raw OTP or a raw refresh JWT.

**Why `UserStats` is created in the same transaction as `User`:** register must not leave a user without a stats row. `accountBalance` later only changes in the payments settlement path — do not credit it from auth.

### Client factory

`src/config/db/database.config.ts` — Prisma 7 + `pg` pool. Copy [`src/config/db/database.config.ts`](../src/config/db/database.config.ts). The pattern is:

```ts
const pool = new pg.Pool({ connectionString: ENV.DATABASE_URL });
const adapter = new PrismaPg(pool);
return new PrismaClient({ adapter, ... });
```

Reuse `global.__prisma` in development so nodemon restarts do not leak pools.

### Generate + push

```bash
npx prisma generate
npx prisma db push          # local: sync schema, no migration file
# later, for real history:
# npx prisma migrate dev --name init_auth_users
```

Then connect from `main.ts` **before** `listen()`:

```ts
await connectDatabase();
const app = CreateApp();
```

If generate fails, the usual cause is a missing `DATABASE_URL` in the environment Prisma CLI sees — `prisma.config.ts` loads dotenv, but a shell without `.env` will not.

---

## 11. Phase 8 — Redis, mail, queues

### Redis

`src/config/redis/redis.config.ts`:

```ts
import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { ENV } from '../env.config.ts';
import { logger } from '../../app/common/utils/logger.util.ts';

export const bullMqConnection: ConnectionOptions = {
  url: ENV.REDIS_URL,
  maxRetriesPerRequest: null,
};

export const redisConnection = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error('Redis error:', err));
```

Two objects on purpose: BullMQ forbids sharing a Redis client that has `maxRetriesPerRequest` other than `null`.

### Mailer

`src/app/common/utils/mailer.util.ts` POSTs to `https://api.brevo.com/v3/smtp/email` with `api-key: ENV.BREVO_API_KEY`. Copy [`src/app/common/utils/mailer.util.ts`](../src/app/common/utils/mailer.util.ts).

HTML bodies live in `src/services/templates/email-templates.ts`:

- `otpVerificationTemplate(name, otp, expiresMin)`
- `passwordResetTemplate(name, otp, expiresMin)`
- `welcomeEmailTemplate(name)`

Auth **never** calls Brevo directly. It enqueues a job.

### BullMQ

`src/config/bull/queue.config.ts` — for this skeleton, two queues:

```ts
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  TOKEN_CLEANUP: 'token-cleanup-queue',
} as const;
```

Email jobs: 3 attempts, exponential backoff 5s. Token cleanup: a repeatable cron `0 3 * * *` (03:00 daily) that deletes expired `UserToken` rows and refresh sessions with `lastUsedAt` older than 7 days.

Workers:

- [`src/app/common/jobs/email.processor.ts`](../src/app/common/jobs/email.processor.ts)
- [`src/app/common/jobs/token-cleanup.processor.ts`](../src/app/common/jobs/token-cleanup.processor.ts)
- [`src/app/common/jobs/scheduler.ts`](../src/app/common/jobs/scheduler.ts)
- [`src/app/common/jobs/index.ts`](../src/app/common/jobs/index.ts) — `initWorkers()` imports processors (side-effect: they start) then registers the cron

`main.ts` calls `await initWorkers()` **after** `listen()`, same process.

`EmailJobData`: `{ to, toName?, subject, htmlContent }`.

---

## 12. Phase 9 — auth primitives (JWT, cookies, OTP)

### JWT — two secrets

`src/app/common/utils/jwt.util.ts`:

```ts
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

generateAccessToken(payload)  // ENV.JWT_ACCESS_SECRET,  15m
generateRefreshToken(payload) // ENV.JWT_REFRESH_SECRET, 7d
verifyAccessToken(token)
verifyRefreshToken(token)
```

Access tokens are **stateless**. Refresh tokens are **stateful**: the JWT is sent to the browser, a SHA-256 hash is stored in `UserToken`.

### Cookies

`src/app/common/utils/cookie.util.ts`:

| Cookie | `httpOnly` | `sameSite` | `secure` | `maxAge` |
| --- | --- | --- | --- | --- |
| `accessToken` | true | `lax` | production only | 15 minutes |
| `refreshToken` | true | `lax` | production only | 7 days |

`path: '/'` so every `/api/v1/*` route sees them.

`setAuthCookies(res, tokens)` / `clearAuthCookies(res)`.

The JSON body of login **does not include tokens**. Swagger in this repo says that explicitly. The SPA relies on the browser storing HttpOnly cookies.

### OTP

`src/app/common/utils/otp.util.ts`:

```ts
generateOtp(6)  // crypto.randomInt, digits only
hashOtp(otp)    // sha256 hex — same helper used to look the row up
```

Compare hashes, never plaintext.

---

## 13. Phase 10 — guards

This is the most important structural piece after Prisma.

### `protect` — use this on every non-auth-module protected route

File: `src/app/common/guards/auth.middleware.ts`

```
cookie accessToken
        │
        ▼
verifyAccessToken (JWT_ACCESS_SECRET)
        │
        ▼
Redis GET user:auth:{userId}     ──miss──►  Prisma user.findUnique
        │                                      │
        │                                      └── SET cache EX 60
        ▼
user missing → 401
user.isActive === false → 403
        │
        ▼
req.user = { userId, email, role }
next()
```

Also export:

- `restrictTo(...roles)` — must run **after** `protect`. Compares `req.user.role`.
- `optionalProtect` — never rejects; attaches `req.user` if a valid cookie exists. Used later for public list endpoints that add extra fields for admins.
- `invalidateUserCache(userId)` — `DEL user:auth:{id}`. Call this when an admin deactivates a user or approves a seller request, otherwise the old role/status lives for up to 60 seconds.

### `authenticate` — do not use on `/users`

File: `src/app/common/guards/authenticate.middleware.ts`

This only verifies the JWT and trusts `decoded` as `req.user`. **No Redis, no DB, no `isActive` check.** In the current repo it is leftover; auth routes that need a logged-in user should use `protect` (and the auth router already does: logout, sessions, `/me`).

If you add a new module tomorrow, import `protect`. Never `authenticate`.

---

## 14. Phase 11 — auth module

### File map

```text
src/app/modules/auth/
├── auth.modules.ts          # export default from './auth.routes.ts'
├── auth.routes.ts           # middleware chain → controller
├── auth.controller.ts       # thin
├── auth.service.ts          # all rules
├── dto/
│   ├── register.dto.ts
│   ├── login.dto.ts
│   ├── verify-otp.dto.ts
│   └── password-reset.dto.ts
├── interfaces/auth.interface.ts
└── doc/auth.swagger.ts
```

### Routes (mount at `/api/v1/auth`)

Put a **stricter** rate limiter on this mount in `app.ts` (10 req / 15 min). Brute-force login and OTP guessing hit this path.

| Method | Path | Guard | Body |
| --- | --- | --- | --- |
| POST | `/register` | `validateDto(registerDto)` | `{ name, email, password }` |
| POST | `/verify-email` | `validateDto(verifyOtpDto)` | `{ email, otp }` |
| POST | `/resend-otp` | `validateDto(resendOtpDto)` | `{ email }` |
| POST | `/forgot-password` | `validateDto(forgotPasswordDto)` | `{ email }` |
| POST | `/reset-password` | `validateDto(resetPasswordDto)` | `{ email, otp, newPassword }` |
| POST | `/login` | `validateDto(loginDto)` | `{ email, password }` |
| POST | `/logout` | `protect` | cookies |
| POST | `/logout-all` | `protect` | cookies |
| GET | `/sessions` | `protect` | — |
| DELETE | `/sessions/:sessionId` | `protect` | — |
| POST | `/refresh-token` | none (reads `refreshToken` cookie) | — |
| GET | `/me` | `protect` | — |
| GET | `/google` | Passport | — |
| GET | `/google/callback` | Passport | — |

Password rules (register + reset): min 8, max 72, upper + lower + digit + special (`@$!%*?&`). Email is trimmed, lowercased.

### Controller pattern

```ts
async login(req, res, next) {
  try {
    const { user, tokens } = await AuthService.login(req.body, getDeviceInfo(req));
    setAuthCookies(res, tokens);
    sendSuccess(res, HTTP_STATUS.OK, MESSAGES.AUTH.LOGIN_SUCCESS, { user });
  } catch (error) {
    next(error);
  }
}
```

`getDeviceInfo` copies `req.ip` and `User-Agent` into the refresh-token row so `GET /sessions` can show devices.

Google callback is the exception: it **redirects** to `FRONTEND_URL` instead of JSON, after `setAuthCookies`.

### Service — implement these methods, in this order

Copy the real logic from [`src/app/modules/auth/auth.service.ts`](../src/app/modules/auth/auth.service.ts). The behavior you must not “simplify away”:

**`register`**

1. Reject duplicate email (`409`)
2. `bcrypt.hash(password, 12)`
3. Transaction: `user.create` + `userStats.create` (zeros)
4. `emailVerified: false`
5. Issue OTP (`emailVerification`) and enqueue email
6. Return sanitized user (strip `password`). **Do not** set cookies yet.

**`verifyEmailOtp`**

1. Lookup user; fake-generic `OTP_INVALID` if missing (do not leak existence more than necessary)
2. Reject if already verified
3. Match `hashOtp(otp)` + `expiresAt > now`
4. Transaction: set `emailVerified: true`, delete all `emailVerification` tokens
5. Enqueue welcome email
6. `issueSession` → cookies

**`resendOtp`**

1. If email unknown → return success anyway (no enumeration)
2. If already verified → `409`
3. If last OTP is younger than 60s → `429` with remaining seconds
4. Delete previous OTPs of that type, issue a new one

**`login`**

1. Unknown email / bad password → same `INVALID_CREDENTIALS` message
2. `isActive === false` → `403` deactivated
3. Unverified → re-issue OTP, `403` `EMAIL_NOT_VERIFIED`
4. `issueSession` + cookies

**`issueSession` (private)**

1. Sign access + refresh JWTs
2. Insert `UserToken` `{ tokenType: refresh, tokenHash: sha256(refreshToken), expiresAt, ip, ua }`

**`refreshToken` (rotation + theft detection)**

1. Verify refresh JWT signature
2. Lookup hash in DB for that `userId`, not expired
3. **If JWT is valid but hash is missing** and the user still has other live refresh rows → treat as reuse of a rotated token → **delete every refresh session** for that user → `401`
4. Otherwise delete the old row, insert a new hash (rotation), set new cookies

**`logout`** — delete only the current refresh hash. **`logoutAll`** — delete every `refresh` row.

**`resetPassword`** — verify OTP, hash new password, delete reset OTPs **and** all refresh sessions (password change logs everyone out).

**`googleLogin`**

1. Find by `provider=google` + `providerId`
2. If email exists as `local` → reject (do not link silently)
3. Else create user with `emailVerified: true`, random bcrypt password (column is required), `userStats`
4. Issue session, redirect SPA

Sanitize with `Omit<User, 'password'>`. Never return `password`.

Passport strategy (`src/config/passport.config.ts`) only maps the Google profile to `{ googleId, name, email, avatar }`. It does **not** touch Prisma — `AuthService.googleLogin` does.

---

## 15. Phase 12 — users module

Auth answers “who is this request?” Users answers “what is on this account?”

### File map

Same five files as auth. Mount at `/api/v1/users`. **No** extra rate limiter — the global 100/15min applies.

### Routes

Every route starts with `protect`. Admin routes add `restrictTo(UserRole.ADMIN)`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/me` | any logged-in | profile without password |
| PATCH | `/me` | any | `name`, `photo`, `cover`, `location` — writes a `profile_updated` activity |
| GET | `/me/stats` | any | `UserStats` (create zeros if missing — belt and suspenders) |
| GET | `/me/activities` | any | paginated `?page&limit` |
| GET | `/me/transactions` | any | ledger rows (empty until payments exist) |
| POST | `/me/seller-request` | USER | one pending request; SELLER/ADMIN rejected |
| GET | `/admin/users` | ADMIN | search + role filter + pagination |
| PATCH | `/admin/users/:userId/status` | ADMIN | `{ isActive }` — cannot target self or another ADMIN; on deactivate, wipe refresh sessions **and** `invalidateUserCache` |
| GET | `/admin/seller-requests` | ADMIN | optional `?status=` |
| PATCH | `/admin/seller-requests/:requestId/review` | ADMIN | `{ status: approved \| rejected }`; on approved, set `role: SELLER` and `invalidateUserCache` |

Skip watchlist until the auctions module exists.

### DTOs

Copy [`src/app/modules/users/dto/users.dto.ts`](../src/app/modules/users/dto/users.dto.ts). `updateUserDtoSchema` requires `.min(1)` so `PATCH {}` is `400`.

### Controller

Same thin pattern. If `!req.user` after `protect`, throw `UNAUTHORIZED` — TypeScript does not know `protect` always set it.

Use **string** ids from `req.params` (UUIDs). Do not `parseInt` them; that is leftover from an older integer-id design and does not match `schema.prisma`.

### Cache invalidation (do not skip)

```ts
await invalidateUserCache(targetUserId);
```

`protect` caches `{ id, email, role, isActive }` for 60 seconds. Approving a seller or deactivating a user must evict that key or the JWT still “works” as the old role until TTL.

Deactivation also deletes refresh tokens so `POST /auth/refresh-token` cannot mint a new access cookie. The current access JWT may live up to 15 minutes unless you also cache-bust (you do).

---

## 16. Phase 13 — wire modules + Swagger + workers

### `src/app.ts` (final for this skeleton)

```ts
app.use(passport.initialize()); // after rateLimit, before json is also fine; this repo does it before json

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Rex Auction API Docs',
  swaggerOptions: { withCredentials: true, filter: true },
}));

app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/users', usersRouter);

app.get('/', (_req, res) => res.send('Welcome to Rex Auction Server'));
app.use(errorHandler);
```

### Swagger

`src/config/swagger.config.ts` — OpenAPI 3, server `http://localhost:5000/api/v1`, security scheme `cookieAuth` on cookie name `accessToken`. Spread `authpaths` and `usersPaths` only.

Each module’s `doc/*.swagger.ts` is a map of path → path item. `apis: []` — no comment scraping.

### `src/main.ts` (final)

```ts
const startServer = async (): Promise<void> => {
  await connectDatabase();

  const app = CreateApp();
  const server = app.listen(ENV.PORT, () => {
    logger.info(`Server running in ${ENV.NODE_ENV} mode on http://localhost:${ENV.PORT}`);
    logger.info('Swagger UI available at: http://localhost:5000/api/docs');
  });

  await initWorkers();

  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();
```

Socket.IO (`initSocketIO`) is **not** part of this skeleton. Add it when you add bidding/chat.

---

## 17. How auth works (end to end)

### Tokens

```
┌─────────────┐     HttpOnly cookie      ┌──────────────────┐
│ accessToken │  15m, JWT_ACCESS_SECRET  │  Stateless       │
│             │  sent on every API call  │  protect() reads │
└─────────────┘                          └──────────────────┘

┌──────────────┐    HttpOnly cookie      ┌──────────────────────────┐
│ refreshToken │  7d, JWT_REFRESH_SECRET │  Hash stored in          │
│              │  only /refresh-token    │  user_tokens.tokenHash   │
└──────────────┘                         └──────────────────────────┘
```

The SPA never reads these cookies from JavaScript (`httpOnly`). CORS `credentials: true` is what sends them.

### Register → verify → session

```
POST /auth/register
  create User (emailVerified=false) + UserStats
  hash OTP → UserToken(emailVerification)
  email-queue ← "Verify your Rex Auction account"
  JSON { user }          ← no cookies

POST /auth/verify-email { email, otp }
  hash match + not expired
  emailVerified=true, delete OTPs
  email-queue ← welcome
  issueSession → Set-Cookie accessToken + refreshToken
```

Login is blocked until that verify step. If they try anyway, login re-sends OTP and returns `403 EMAIL_NOT_VERIFIED`.

### Login → use a protected route → refresh

```
POST /auth/login
  bcrypt.compare
  issueSession (new refresh row + cookies)

GET /users/me
  protect → cookie → JWT → Redis/Prisma → req.user
  UsersService.getUserProfile(req.user.userId)

… 15 minutes later, access JWT expires …

POST /auth/refresh-token          (refresh cookie only)
  verify refresh JWT
  lookup hash
  DELETE old row + INSERT new hash     ← rotation
  Set-Cookie new pair
```

If an attacker steals an **old** refresh cookie after rotation and replays it: signature still verifies, hash is gone, other sessions still exist → **wipe all sessions**. That is the theft signal in `AuthService.refreshToken`.

### Password reset

```
POST /auth/forgot-password { email }
  always 200  (no enumeration)
  if active user: OTP type=passwordReset + email

POST /auth/reset-password { email, otp, newPassword }
  verify OTP
  bcrypt new password
  delete passwordReset tokens
  delete ALL refresh tokens          ← logout everywhere
```

### Roles

| Role | How you get it |
| --- | --- |
| `USER` | default on register |
| `SELLER` | admin approves `POST /users/me/seller-request` |
| `ADMIN` | not via API in this skeleton — set in the database |

`restrictTo(UserRole.ADMIN)` is how `/users/admin/*` is locked. A stolen USER access token cannot call those routes even if the JWT is valid.

### Google

```
GET /auth/google
  → Google consent
GET /auth/google/callback
  → passport profile
  → AuthService.googleLogin
  → cookies
  → 302 FRONTEND_URL?success=true
```

Google accounts skip OTP (`emailVerified: true`). A local password account with the same email is **not** merged.

---

## 18. How a request actually moves

Example: `PATCH /api/v1/users/me` with `{ "name": "Saimor" }`.

1. `helmet` / `cors` / global `rateLimit`
2. `passport.initialize()` (no-op unless `/auth/google`)
3. `express.json` parses body (capped at 10kb)
4. `cookieParser` fills `req.cookies.accessToken`
5. Router: `protect` → `validateDto(updateUserDtoSchema)` → `usersController.updateProfile`
6. `protect` verifies JWT, loads user from Redis (or Prisma), sets `req.user`
7. Joi strips unknown fields, requires at least one of `name|photo|cover|location`
8. Controller calls `UsersService.updateUserProfile(userId, body)`
9. Service updates `User` and inserts `UserActivity` in one transaction
10. `sendSuccess(200, 'User updated successfully', { user })`
11. If anything threw `AppError` or Prisma exploded, `errorHandler` is the response — the controller only `next(e)`

That same chain is how you add a third module later: new folder, new router, `app.use('/api/v1/...', router)`, nothing else in `main.ts`.

---

## 19. Verify it

There is no test suite (`npm test` is a stub). Practical loop:

```bash
npx prisma generate
npx prisma db push
npx prisma validate
npm run build          # tsc typecheck
npm run dev
```

Then, with a REST client that **stores cookies** (or curl `-c` / `-b`):

```bash
# 1. register
curl -s -X POST http://localhost:5000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Saimor","email":"saimor@example.com","password":"StrongPass1!"}'

# 2. read OTP from your mail (or from user_tokens in a local-only debug — do not log OTP in production)

# 3. verify (saves cookies)
curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/verify-email \
  -H 'Content-Type: application/json' \
  -d '{"email":"saimor@example.com","otp":"123456"}'

# 4. protected users route
curl -s -b cookies.txt http://localhost:5000/api/v1/users/me

# 5. refresh
curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:5000/api/v1/auth/refresh-token

# 6. logout
curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:5000/api/v1/auth/logout
```

Open `http://localhost:5000/api/docs` — “Authorize” is the `accessToken` cookie; Swagger is configured with `withCredentials: true`.

Promote one user to admin when you need `/users/admin/*`:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

Then hit a protected route once so `invalidateUserCache` is not fighting a stale `USER` cache — or wait 60s / restart Redis.

---

## 20. What you are not building yet

On purpose, so the skeleton stays teachable:

| Full repo | Why it waits |
| --- | --- |
| Auctions, bidding, Socket.IO | Needs Redis locks + BullMQ `start-auction` / `end-auction` jobs |
| Payments / SSLCommerz | Needs `EndedAuction` + `decimal.js` fee split; `UserStats.accountBalance` only changes there |
| Cloudinary / multer | Profile `photo` in this skeleton is a URL string, not an upload |
| Chat, blog, announcements | Same module pattern; copy `users/` and rename |
| Watchlist | FK to `Auction` |
| `xss.middleware.ts` | Implemented in the full repo but **not mounted** in `app.ts` — do not “fix” that here without a decision |

When you add the next module:

```text
src/app/modules/<name>/
  <name>.routes.ts
  <name>.controller.ts
  <name>.service.ts
  dto/<name>.dto.ts
  doc/<name>.swagger.ts
```

Middleware order on each route: `protect` (or `optionalProtect`) → `restrictTo(...)` → `validateDto` → handler.

Then register it once in `CreateApp` and spread its swagger paths.

---

## Dependency checklist (auth + users only)

Runtime:

```
express helmet cors cookie-parser hpp express-rate-limit
dotenv joi winston
@prisma/client @prisma/adapter-pg pg
bcryptjs jsonwebtoken
ioredis bullmq
passport passport-google-oauth20
swagger-jsdoc swagger-ui-express
```

Dev:

```
typescript tsx nodemon prettier
@types/node @types/express @types/cors @types/cookie-parser @types/hpp
@types/bcryptjs @types/jsonwebtoken
@types/passport @types/passport-google-oauth20
@types/swagger-jsdoc @types/swagger-ui-express
prisma
```

Not required until later modules: `cloudinary`, `multer`, `decimal.js`, `socket.io`, `sslcommerz-lts`, `xss`, `express-session`.

---

## Where the real files live

Use this guide for **order**. Use these files as the source of truth for **code**:

| Piece | Path |
| --- | --- |
| Process boot | `src/main.ts` |
| Middleware + mounts | `src/app.ts` |
| Env | `src/config/env.config.ts` |
| Prisma client | `src/config/db/database.config.ts` |
| Schema (full product) | `prisma/schema.prisma` |
| `protect` | `src/app/common/guards/auth.middleware.ts` |
| Auth service | `src/app/modules/auth/auth.service.ts` |
| Users service | `src/app/modules/users/users.service.ts` |
| Auth flows (narrative) | [docs/auth/auth.md](./auth/auth.md) |
| Users HTTP contract | [docs/api-reference.md](./api-reference.md#users) |
