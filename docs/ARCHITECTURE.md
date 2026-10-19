# Sona backend architecture

Sona starts as a modular NestJS application so one team can ship safely without the operational cost
of premature microservices. Module boundaries are extraction seams: authentication, patients,
therapists, administration, wellness sessions, notifications, and real-time communications must not
share transport-specific state.

## Runtime boundaries

- **PostgreSQL:** identities, role/status, onboarding, therapist verification, availability, session
  metadata, encrypted therapist notes, refresh-session hashes, and audit events.
- **Redis (next delivery slice):** matching queue coordination and ephemeral chat with explicit TTL.
  Chat content must never be copied into PostgreSQL, logs, analytics, or audit metadata.
- **Private object storage (next delivery slice):** therapist credentials and approved attachments.
  Store opaque object keys only; use short-lived signed URLs, malware scanning, and access auditing.
- **WebRTC provider (next delivery slice):** audio/video room tokens. Tokens are short-lived and are
  never persisted after a session ends.

## Identity and authorization

Patients are shown to therapists by generated alias. Legal names, email addresses, display names,
intake context, rejection reasons, and therapist notes use field encryption or non-reversible blind
indexes. Access requires both role checks and resource ownership/assignment checks. A verified
therapist may only see queue entries in the therapist's configured jurisdiction.

## Session state

`QUEUED -> ACTIVE -> COMPLETED` is the normal immediate-support path. A crisis signal changes the
state to `ESCALATED` and returns emergency-resource guidance; Sona does not claim to be an emergency
service. Session acceptance uses a conditional database update so two therapists cannot claim the
same session.

## Production gates

The present code is an engineering foundation, not a HIPAA certification. Before real health data,
complete the launch controls in [HIPAA.md](HIPAA.md), connect contracted vendors with BAAs, and run
the threat model, privacy review, penetration test, restore exercise, and incident-response drill.
