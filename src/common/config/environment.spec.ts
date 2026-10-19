import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

const base = {
  DATABASE_URL: 'postgresql://localhost/sona',
  REDIS_URL: 'redis://localhost',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
};

describe('validateEnvironment', () => {
  it('accepts local development transports', () => {
    expect(validateEnvironment(base).NODE_ENV).toBe('development');
  });

  it('fails closed on plaintext production transports', () => {
    expect(() => validateEnvironment({ ...base, NODE_ENV: 'production' })).toThrow('Production requires TLS');
  });
});
