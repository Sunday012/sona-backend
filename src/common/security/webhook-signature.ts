import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhookSignature(secret: string, body: Buffer, signature: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature.trim());
  return left.length === right.length && timingSafeEqual(left, right);
}
