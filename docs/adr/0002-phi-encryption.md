# ADR 0002: PHI field encryption and blind indexes

## Decision

Sensitive fields are encrypted with authenticated AES-256-GCM and stored as versioned ciphertext. Equality-search fields also store a keyed HMAC blind index over normalized input.

## Consequences

- Ciphertext detects tampering and supports future key/provider versions.
- Blind indexes reveal equality patterns, so database/volume encryption and strict access controls remain required.
- Partial, fuzzy, and range queries over encrypted data are unavailable without a separately reviewed search design.
- Production must replace the local raw key with envelope encryption backed by KMS/HSM.
