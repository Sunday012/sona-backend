import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './webhook-signature.js';

describe('verifyWebhookSignature', () => {
  it('accepts the exact signed raw body and rejects tampering', () => {
    const body = Buffer.from('{"event":"result.ready"}');
    const signature = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
    expect(verifyWebhookSignature('webhook-secret', body, signature)).toBe(true);
    expect(verifyWebhookSignature('webhook-secret', Buffer.from('{}'), signature)).toBe(false);
  });
});
