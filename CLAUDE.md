# CLAUDE.md

Guidance for Claude Code when working in this repository. Human-facing docs live in [README.md](./README.md) and [docs/](./docs/) — read those for feature/API detail; this file is about how to work in the codebase correctly.

## What this is

Rex Auction Server: Node.js/Express 5/TypeScript (ESM, run via `tsx`, no build step in dev) backend for a real-time auction platform. Prisma 7 + PostgreSQL, Redis (cache/locks/presence), BullMQ (jobs), Socket.IO (live bidding/chat/notifications), SSLCommerz (payments), Cloudinary (media), Brevo (email).

Full architecture, endpoint tables, and per-service deep dives: [README.md](./README.md), [docs/api-reference.md](./docs/api-reference.md), [docs/auth/auth.md](./docs/auth/auth.md), [docs/services/](./docs/services/).

## Commands

```bash
npm run dev            # nodemon + tsx, watches src/**/*.ts — use this while developing
npm run start          # tsx src/main.ts (no compile step)
npm run build          # tsc — compiles to JS; not wired into `start`, verify before assuming it's used in deploy
npm run format          # prettier --write .
npm run format:check    # prettier --check .
npx prisma generate      # after any schema.prisma change
npx prisma db push       # sync schema to the dev database (no migration file)
npx prisma migrate dev --name <name>   # create a real migration (use for anything beyond local scratch changes)
```

There is **no test suite** (`npm test` is a stub) and **no ESLint config** — only Prettier. Don't assume `npm test` or `npm run lint` exist; don't invent them. When making a change, the practical verification loop is: `npm run build` (typecheck) + manually exercise the affected route/socket event + `npx prisma validate` if the schema changed.

## Module pattern — follow this exactly for new features

Every feature under `src/app/modules/<name>/` has:

```
<name>.routes.ts        # Express Router: middleware chain → controller method
<name>.controller.ts     # thin: parse req → call service → sendSuccess(res, ...) → catch(e){next(e)}
<name>.service.ts        # all business logic: Prisma, Redis, BullMQ, Socket.IO emits
dto/<name>.dto.ts        # Joi schemas, one per request shape
doc/<name>.swagger.ts    # Swagger path objects, spread into src/config/swagger.config.ts
```

Controllers must stay thin — never put Prisma calls, Redis calls, or business rules in a controller. Route middleware order is always `protect (or optionalProtect) → restrictTo(...) → validateDto/validateFormDto → upload.single/array` before the handler; see [Auth guard reference](./README.md#auth-guard-reference).

When adding a route that needs auth, use `protect` from `src/app/common/guards/auth.middleware.ts` — **not** `authenticate` from `authenticate.middleware.ts`, which is a legacy guard scoped to the auth module only (it skips the Redis/DB user lookup, so a deactivated user's token would still pass).

Throw `AppError(message, statusCode)` for expected/operational failures (validation, not-found, forbidden) — the global `errorHandler` formats these into `{ success: false, message }`. Let unexpected errors propagate; don't wrap everything in try/catch that swallows errors — controllers should only `catch(e){ next(e) }`.

All money fields (bids, fees, balances) use `decimal.js` (`Decimal`), never native `number` arithmetic — see the fee-split and auto-bid resolution code in [README.md](./README.md#-payments-sslcommerz) for the pattern to follow.

## Data model

[prisma/schema.prisma](./prisma/schema.prisma) is the single source of truth for the data model — read it directly rather than inferring shapes from service code. Key relationships to keep in mind when touching auctions/bidding/payments:

`Auction` → `LiveBid` (append-only bid feed, real-time) / `AutoBid` (one row per user per auction) → `EndedAuction` (created once, at settlement, by `AuctionsService.endAuction`) → `Payment` (created when the winner checks out) → `Transaction` (ledger entries written atomically with `Payment`/`UserStats` in `_processPaidTransaction`).

`UserStats.accountBalance` only ever changes in one place: the payments settlement transaction. Don't add a second code path that credits/debits it directly — route balance changes through the `Transaction` + `UserStats` pattern already used there.

## Real-time and background work

- Socket.IO namespaces (`/auction`, `/chat`, `/notifications`) share business logic with their REST equivalents (e.g. `BiddingService.placeBid` backs both `POST /bidding/place` and the `bid:place` socket event) — when changing bidding/chat logic, update the service, not each transport separately. See [docs/services/sockets.md](./docs/services/sockets.md).
- Auction start/end is driven by delayed BullMQ jobs (`auction-queue`, deterministic `jobId`s `start-auction-{id}`/`end-auction-{id}`), not polling. If you change `startTime`/`endTime` handling, check `AuctionsService.scheduleTransitions`/`cancelScheduledTransitions`. See [docs/services/bullmq.md](./docs/services/bullmq.md).
- Bidding mutations must acquire the per-auction Redis lock (`withLock`, key `auction:{id}:lock`) — don't write a new code path that mutates `Auction.currentBid`/`LiveBid` without going through it, or concurrent bids can race.

## Known rough edges (don't "fix" silently — flag or ask first)

- **`xss.middleware.ts` is dead code** — implemented but never mounted in `app.ts`. Request bodies are not currently XSS-sanitized.
- **`REDIS_URL` and the three `CLOUDINARY_*` vars aren't validated at startup** the way other required env vars are (`env.config.ts`'s `required()` helper isn't used for them). A missing value fails at first use, not at boot.
- **REST `POST /chat/messages` doesn't broadcast live** — only the `chat:send` socket event emits `chat:message`/`notification:new`. This may be intentional (forcing clients onto sockets) or an oversight; don't assume either way without asking.
- **`npm run build` isn't referenced by `npm start`** — confirm the actual deploy process before assuming compiled output is used anywhere.

Full detail and a prioritized hardening list (tests, CI, lint, Dockerfile, etc.) are in the root [README's "Known Gaps" and "Suggestions to Harden This Project" sections](./README.md#-known-gaps--notes-for-contributors).

## Docs maintenance

If you change a route, DTO, socket event, queue, or env var, update the relevant doc in the same change:

| Change | Update |
| --- | --- |
| Route/DTO in a non-auth module | [docs/api-reference.md](./docs/api-reference.md) |
| Auth/session behavior | [docs/auth/auth.md](./docs/auth/auth.md) |
| Socket.IO event | [docs/services/sockets.md](./docs/services/sockets.md) |
| BullMQ queue/job | [docs/services/bullmq.md](./docs/services/bullmq.md) |
| Payment/fee logic | [docs/services/payments.md](./docs/services/payments.md) |
| Redis key/usage | [docs/services/redis.md](./docs/services/redis.md) |
| Env var | [README.md environment table](./README.md#-environment-variables-reference) |

Keep this file (`CLAUDE.md`) itself updated when the module pattern, commands, or known rough edges change — it should stay a short, accurate map, not a duplicate of the README.
