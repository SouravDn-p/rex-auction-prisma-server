import { ENV } from '../../../config/env.config.ts';
import { logger } from './logger.util.ts';

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export const sendTransactionalEmail = async ({
  to,
  toName,
  subject,
  htmlContent,
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