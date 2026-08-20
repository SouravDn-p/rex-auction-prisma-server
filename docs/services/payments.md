# Payments (SSLCommerz)

Module: [`src/app/modules/payments/`](../../src/app/modules/payments/). Handles auction settlement via the [SSLCommerz](https://developer.sslcommerz.com/) payment gateway (`sslcommerz-lts`), including gateway callbacks, IPN-driven settlement, an automatic 80/20 seller/platform split, and invoice generation.

## Environment Variables

```ini
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=
SSLCOMMERZ_IS_LIVE=false        # true for the live gateway, false for sandbox
PLATFORM_FEE_PERCENT=20          # platform's cut of every settled payment
```

## Routes

```ts
// src/app/modules/payments/payments.routes.ts
router.get('/initiate/:auctionId', protect, restrictTo('USER', 'ADMIN'), initiate);
router.post('/success', handleSuccess);
router.post('/fail', handleFail);
router.post('/cancel', handleCancel);
router.post('/ipn', handleIpn);
router.get('/status/:trxId', protect, getPaymentStatus);
router.get('/invoice/:invoiceNumber', protect, getInvoice);
router.get('/my-payments', protect, getMyPayments);
router.get('/admin/all', protect, restrictTo('ADMIN'), adminGetAll);
router.get('/admin/revenue', protect, restrictTo('ADMIN'), adminGetRevenue);
```

`/success`, `/fail`, `/cancel`, `/ipn` are SSLCommerz's own callback URLs — the gateway (server-to-server for IPN, browser redirect for the others) hits these directly, not the frontend SPA. `app.ts` explicitly excludes all four from the global rate limiter:

```ts
// src/app.ts
const PAYMENT_CALLBACK_PATHS = [
  '/api/v1/payments/success',
  '/api/v1/payments/fail',
  '/api/v1/payments/cancel',
  '/api/v1/payments/ipn',
];
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => PAYMENT_CALLBACK_PATHS.includes(req.path),
}));
```

## End-to-end flow

```
Buyer                Rex Auction API              SSLCommerz            Database / Redis
  │  GET /initiate/:auctionId
  ├────────────────────►│
  │                      │ verify caller == EndedAuction.winnerId, not already PAID
  │                      │ create/reuse Payment row (PENDING), compute fee split
  │                      │ sslcz.init(...) ───────────►│
  │                      │◄──────────── GatewayPageURL │
  │◄── 302 redirect ─────┤
  │  (browser navigates to SSLCommerz-hosted checkout)
  │───────────────────────────────────────────────────►│  buyer pays on SSLCommerz's page
  │                      │◄── POST /success (browser redirect) ─┤
  │                      │ sslcz.validate({val_id}) ───►│
  │                      │◄───────────────── valid ─────┤
  │                      │ Payment: PENDING → PROCESSING (no wallet changes yet)
  │◄── redirect to /payment/processing ──┤
  │                      │◄── POST /ipn (server-to-server, async) ┤
  │                      │ idempotency check (Redis) + distributed lock
  │                      │ sslcz.validate again (never trust the IPN payload blindly)
  │                      │ _processPaidTransaction()  ← money actually moves here
```

### 1. Initiate (`GET /payments/initiate/:auctionId`)

`PaymentService.initiate`:

* Requires the caller to be `EndedAuction.winnerId` for that auction, and the auction not already `PAID`.
* Reuses an existing `PENDING` `Payment` created within the last 30 minutes (`PENDING_PAYMENT_REUSE_MS`) instead of creating a duplicate if the buyer re-opens the checkout.
* Otherwise creates a new `Payment` row with a generated transaction id, `trxId = REX-{timestamp}-{4-byte-hex}`, and the fee split computed and stored up front (see below).
* Calls `sslcz.init(...)` and 302-redirects the browser to the returned `GatewayPageURL`.

### 2. Success redirect (`POST /payments/success`)

Browser-driven, fired when the buyer finishes paying on SSLCommerz's page. `handleSuccess`:

* Idempotency-checks the payment's current status.
* Calls SSLCommerz's Validation API (`sslcz.validate({ val_id })`) — the redirect alone is never trusted.
* On success, moves `Payment.status: PENDING → PROCESSING` only — **wallets/ledgers are not touched here.**
* Redirects the browser to a frontend "processing" page while the real settlement happens asynchronously via IPN.

### 3. IPN webhook (`POST /payments/ipn`) — the only place money moves

This is SSLCommerz's server-to-server Instant Payment Notification, which can arrive before, after, or instead of the browser hitting `/success` (and can be retried by the gateway). The controller responds `200 OK` immediately, then processes `PaymentService.handleIPN` asynchronously so the webhook isn't blocked on business logic:

* **Idempotency flag**: Redis key `payment:ipn:processed:{trxId}`, 24h TTL — a second delivery of the same IPN is a no-op.
* **Distributed lock**: Redis key `payment:ipn:lock:{trxId}` (`SET NX`, 30s) — guards against two concurrent IPN deliveries for the same transaction racing each other.
* Re-validates via SSLCommerz's Validation API before touching anything (same as `/success` — the raw IPN payload is never trusted on its own).
* Calls the private `_processPaidTransaction`, which runs everything in **one `prisma.$transaction`**:

  1. `Payment.status → PAID`, sets `paidAt`, `ipnData`, and a generated `invoiceNumber`.
  2. `EndedAuction.paymentStatus → PAID`.
  3. `Auction.status → sold`, `Auction.paymentStatus → PAID`.
  4. `Transaction` (`type: auction_payment`) — full amount, recorded against the buyer.
  5. `Transaction` (`type: seller_earning`) — `sellerProceeds` (80%), recorded against the seller.
  6. `Transaction` (`type: platform_fee`, negated) — `serviceFee` (20%), recorded against the seller for audit purposes.
  7. `UserStats.accountBalance` incremented by `sellerProceeds` for the seller — **this is the only step that actually changes a spendable balance.**
  8. `UserStats.totalSpent` incremented by the total amount for the buyer.
  9. `UserActivity` (`payment_made`) logged for the buyer.
  10. `Notification`s created for both the seller (`payment_received`) and the buyer (`payment_confirmed`).

* After the transaction commits: marks the IPN processed in Redis, deletes the cached `payment:trx:{trxId}` key, and enqueues two fire-and-forget `email-queue` jobs (`payment-invoice-buyer`, `payment-proceeds-seller`, `priority: 1`) built from `invoice.util.ts` HTML templates.

### 4. Fail / cancel (`POST /payments/fail`, `POST /payments/cancel`)

Mark the `Payment` row `FAILED`/`CANCELLED` and redirect the browser to the corresponding frontend page. No ledger changes.

## Fee split

`PLATFORM_FEE_PERCENT` (default `20`) drives the split, computed once at `initiate` time and stored on the `Payment` row so it can't drift if the env var changes before settlement:

```ts
// src/app/modules/payments/payments.service.ts
const PLATFORM_FEE = new Decimal(ENV.PLATFORM_FEE_PERCENT).div(100); // 0.20

const computeSplit = (amount: Decimal) => {
  const serviceFee = amount.mul(PLATFORM_FEE).toDecimalPlaces(2);
  const sellerProceeds = amount.minus(serviceFee).toDecimalPlaces(2);
  return { serviceFee, sellerProceeds };
};
```

All money math uses `decimal.js` (`Decimal`), never native floating point, throughout the payments and bidding modules.

## Invoices

[`invoice.util.ts`](../../src/app/common/utils/payments/invoice.util.ts):

* `generateInvoiceNumber(paymentId)` → `"REX-INV-{YYYYMM}-{paymentId padded to 6}"`
* `buildInvoiceEmailHtml(invoiceData)` → inline-styled HTML for the buyer's receipt
* `buildSellerPaymentHtml({...})` → inline-styled HTML for the seller's payout notice

These HTML builders back three different surfaces from one source: the queued settlement emails, the `GET /payments/invoice/:invoiceNumber` HTML response, and the JSON returned by `GET /payments/status/:trxId`.

## Access control

`getPaymentStatus` and `getInvoice` only permit the buyer, the seller (via `payment.auction.sellerId`), or an `ADMIN` to view a given payment/invoice — everyone else gets a 403/404 via `AppError`.

## Admin endpoints

* `GET /payments/admin/all` — every payment, for support/ops.
* `GET /payments/admin/revenue` — aggregate platform revenue (sum of `platform_fee` transactions).
