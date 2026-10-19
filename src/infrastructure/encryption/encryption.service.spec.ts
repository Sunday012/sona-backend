import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { EncryptionService } from './encryption.service.js';

describe('EncryptionService', () => {
  const service = new EncryptionService(
    new ConfigService({ FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') }),
  );

  it('round trips authenticated ciphertext without exposing plaintext', () => {
    const ciphertext = service.encrypt('patient@example.com');
    expect(ciphertext).not.toContain('patient@example.com');
    expect(service.decrypt(ciphertext)).toBe('patient@example.com');
  });

  it('creates stable normalized blind indexes', () => {
    expect(service.blindIndex(' Patient@Example.com ')).toBe(service.blindIndex('patient@example.com'));
  });

  it('rejects tampered ciphertext', () => {
    const ciphertext = service.encrypt('protected');
    expect(() => service.decrypt(`${ciphertext.slice(0, -1)}A`)).toThrow();
  });
});
