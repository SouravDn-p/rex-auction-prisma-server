# Brevo Email Service

Brevo is used for transactional email delivery, including OTP verification, password resets, and welcome emails.

## Environment Variables

```ini
BREVO_API_KEY=
MAIL_FROM=
MAIL_FROM_NAME=Rex Auction
```

## Flow

1. The auth service generates an OTP.
2. The OTP is hashed and saved in the `UserToken` table.
3. The app renders an HTML template.
4. The mail utility sends the message through Brevo's transactional endpoint.
5. If the mail request fails, the error is logged and the request is rejected.

## Code Snippet

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

## Templates

OTP and welcome emails are generated from:

* `otpVerificationTemplate(name, otp, expiresInMin)`
* `passwordResetTemplate(name, otp, expiresInMin)`
* `welcomeEmailTemplate(name)`

## Operational Notes

* Brevo is used for SMTP-style transactional delivery, not for long-lived inbox sync.
* OTP content is not stored in plaintext in the database.
* The same sender identity is used for all auth-related messages.
