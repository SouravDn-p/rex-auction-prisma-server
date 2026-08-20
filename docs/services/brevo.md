# Brevo Email Service

[Brevo](https://www.brevo.com/) (formerly Sendinblue) handles all transactional email: OTP verification, password reset, welcome emails, and payment invoice/proceeds notifications. Every send goes through the `email-queue` BullMQ worker rather than being sent inline on the request — see [docs/services/bullmq.md](./bullmq.md).

## Environment Variables

```ini
BREVO_API_KEY=
MAIL_FROM=
MAIL_FROM_NAME=Rex Auction
```

`BREVO_API_KEY` and `MAIL_FROM` are required at startup (`env.config.ts` throws if missing); `MAIL_FROM_NAME` defaults to `"Rex Auction"`.

## Flow

```
Service (auth / payments)
  → builds { to, toName?, subject, htmlContent }
  → emailQueue.add(...)                         (BullMQ, async, retried on failure)
      → email.processor.ts worker picks it up
        → sendTransactionalEmail(...)            (mailer.util.ts)
          → POST https://api.brevo.com/v3/smtp/email
```

1. The calling service (auth OTP flow, payment settlement) builds the email payload and enqueues it on `email-queue` instead of awaiting the send inline — this keeps the triggering request fast and lets BullMQ retry on transient failure.
2. The `email.processor.ts` worker consumes the job and calls `sendTransactionalEmail`.
3. If Brevo returns a non-2xx response, `sendTransactionalEmail` throws — BullMQ's retry policy (3 attempts, exponential backoff starting at 5s) takes over from there.

## Mailer utility

```ts
// src/app/common/utils/mailer.util.ts
export const sendTransactionalEmail = async ({
  to, toName, subject, htmlContent,
}: SendEmailParams): Promise<void> => {
  const response = await fetch(BREVO_API_URL, {
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

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`Brevo send failed (${response.status}): ${errorBody}`);
    throw new Error(`Failed to send email: ${response.status}`);
  }
};
```

## Templates

HTML bodies are built by plain functions, not a templating engine — each returns a complete inline-styled HTML string:

| Template | File | Used by |
| --- | --- | --- |
| `otpVerificationTemplate(name, otp, expiresInMin)` | `src/services/templates/` | Registration OTP — [docs/auth/auth.md](../auth/auth.md) |
| `passwordResetTemplate(name, otp, expiresInMin)` | `src/services/templates/` | Password reset OTP |
| `welcomeEmailTemplate(name)` | `src/services/templates/` | Post-verification welcome email |
| `buildInvoiceEmailHtml(invoiceData)` | `src/app/common/utils/payments/invoice.util.ts` | Buyer receipt after a payment settles |
| `buildSellerPaymentHtml({...})` | same | Seller payout notice after a payment settles |

See [docs/services/payments.md](./payments.md) for the invoice templates specifically, and [docs/auth/auth.md](../auth/auth.md) for the full OTP lifecycle.

## Operational notes

* Brevo is used purely as a transactional SMTP-style API — there's no inbox sync, no bounce/webhook handling wired into this codebase today.
* OTP values are never stored in plaintext — only a SHA-256 hash is persisted (`UserToken.tokenHash`, via `hashOtp` in [`otp.util.ts`](../../src/app/common/utils/otp.util.ts)); the plaintext OTP exists only in memory long enough to be emailed.
* All outbound mail shares the same sender identity (`MAIL_FROM` / `MAIL_FROM_NAME`) — there's no per-module "from" override.
* Because sends are queued, a Brevo outage doesn't fail the triggering HTTP request (registration, checkout) — it only delays the email, subject to the queue's 3-attempt retry policy.
