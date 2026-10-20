import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LifecycleEmail = 'verify-email' | 'reset-password';

interface SendLifecycleEmailInput {
  recipient: string;
  token: string;
  type: LifecycleEmail;
}

/**
 * Sends transactional mail through Resend without putting provider secrets in
 * the application or exposing lifecycle tokens in API responses.
 *
 * Email is intentionally a best-effort side effect. The account/token is
 * persisted first; users can safely request another message if a provider is
 * temporarily unavailable.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendLifecycleEmail(input: SendLifecycleEmailInput): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM_EMAIL');
    if (!apiKey || !from) {
      this.logger.warn('Transactional email is not configured; lifecycle email was not sent');
      return;
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
    const isVerification = input.type === 'verify-email';
    const actionUrl = isVerification
      ? `${frontendUrl}/verify-email?token=${encodeURIComponent(input.token)}`
      : `${frontendUrl}/reset-password?token=${encodeURIComponent(input.token)}`;
    const subject = isVerification ? 'Verify your Sona email address' : 'Reset your Sona password';
    const heading = isVerification ? 'Verify your email address' : 'Reset your password';
    const body = isVerification
      ? 'Confirm your email address to start using your Sona account.'
      : 'We received a request to reset your Sona password. This link expires in one hour.';

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [input.recipient],
          subject,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#173c33"><h2>${heading}</h2><p>${body}</p><p><a href="${actionUrl}" style="display:inline-block;background:#165c4b;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">${
            isVerification ? 'Verify email' : 'Reset password'
          }</a></p><p style="color:#65756f;font-size:13px">If you did not request this, you can safely ignore this email.</p></div>`,
        }),
      });
      if (!response.ok) {
        const details = await response.text();
        this.logger.error(`Resend rejected lifecycle email (${response.status}): ${details.slice(0, 500)}`);
      }
    } catch (error) {
      this.logger.error('Resend request failed', error instanceof Error ? error.message : String(error));
    }
  }
}
