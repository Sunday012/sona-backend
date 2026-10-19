const sensitiveKeys = new Set([
  'authorization',
  'cookie',
  'password',
  'token',
  'diagnosis',
  'medication',
  'ssn',
  'mfaSecret',
  'encryptedPayload',
]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sensitiveKeys.has(key) ? '[REDACTED]' : redact(child),
      ]),
    );
  return value;
}
