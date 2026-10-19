# HIPAA security posture and readiness gaps

**Status: engineering foundation, not approved for production PHI.** HIPAA compliance includes administrative, physical, and technical safeguards. This document is a control map and launch checklist, not a certification.

## Technical controls present

- Strict DTO validation rejects unknown input fields.
- Access JWTs expire after 15 minutes and enforce the access-token type. Refresh sessions are stored
  as hashes, rotate on use, expire after 30 days, and are revoked on logout or password reset.
- Passwords use Argon2; repeated login failures produce a timed lockout.
- Role guards are separate from authentication guards.
- PHI-related routes have an audit decorator and append-only audit schema. The database trigger template must be activated in the generated migration.
- Structured audit output can be shipped to a SIEM; request bodies and query values are intentionally absent.
- AES-256-GCM field encryption uses self-describing ciphertext. Keyed blind indexes permit equality lookup without storing searchable plaintext.
- Intake text is scrubbed for common direct identifiers before encrypted persistence. Crisis-language
  flags interrupt the matching flow; chat content is not stored in PostgreSQL.
- Patient, therapist, administrator, ownership, assignment, verification, and jurisdiction checks
  constrain the implemented wellness workflows.
- Production startup fails if PostgreSQL or Redis transport is not TLS-protected or secrets are placeholders.
- Trusted-host validation, explicit CORS origins, body limits, throttling, no-store caching, and restrictive security headers are enabled.
- Webhook verification uses HMAC and constant-time comparison against raw request bytes.
- API documentation is unavailable in production.

## Required before real PHI

- Replace the local encryption key with a KMS/HSM envelope-encryption provider and document rotation/recovery.
- Add refresh-token family reuse detection, secure cookie + CSRF handling, mandatory MFA for workforce
  accounts, session idle timeout, and administrator-driven global revocation.
- Implement care-team/tenant scoping and ownership checks. Current role checks alone are not sufficient authorization.
- Finish the break-glass workflow: limited duration, structured reason, encrypted justification, notifications, and privacy-officer review.
- Apply and test the append-only database trigger; run the application with a non-owner, least-privilege database role.
- Add immutable audit export and documented retention (typically six years for required HIPAA documentation; validate with counsel).
- Configure encrypted backups, restore exercises, disaster recovery objectives, monitoring, alerting, and incident response.
- Add PHI-safe object storage policies: private buckets, encryption, malware/file validation, short-lived URLs, and access audit.
- Add automated secret scanning, dependency scanning, SAST/DAST, penetration testing, and security regression tests in CI.
- Execute BAAs with every cloud/vendor/subprocessor that may receive PHI. Disable analytics/session replay on authenticated health surfaces unless explicitly reviewed and contracted.
- Complete organizational risk analysis, workforce training, access review/termination procedures, device policies, breach notification playbook, and disaster recovery exercises.

## Rules for contributors

1. Never put PHI in logs, URLs, metrics labels, analytics, crash reports, push/SMS bodies, test fixtures, or issue trackers.
2. Use synthetic data in every non-production environment.
3. Collect the minimum necessary data and return audience-specific response objects.
4. Add an audited event for every PHI read, export, mutation, disclosure, permission change, failed authentication, and emergency access.
5. Treat every webhook and file upload as hostile input.
6. A new PHI-touching vendor requires security/privacy review and a BAA before enablement.
