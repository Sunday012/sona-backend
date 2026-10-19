# Sona Backend

Independent NestJS mental-wellness API repository built with Fastify, Prisma, PostgreSQL, and a
Redis-ready real-time boundary. This repository is intentionally separate from Sona's frontend
repository and has no Campus Plug runtime or environment dependency.

> This is a pre-production technical foundation, not a claim of HIPAA compliance. Complete the controls in [docs/HIPAA.md](docs/HIPAA.md) before processing real PHI.

## Run locally

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The API runs on `http://localhost:8080`; development Swagger documentation is at `http://localhost:8080/api/v1/docs`.

## Implemented foundation

- Adult patient and therapist registration with pseudonymous patient aliases
- Email verification, login lockout, access/refresh token rotation, logout, and password reset
- Patient preferences and therapist professional onboarding
- Credential metadata registration and manual administrator approval/rejection
- Therapist availability and jurisdiction-filtered immediate-support queues
- Direct-identifier scrubbing, crisis-language interruption, session acceptance/end/escalation/rating
- AES-256-GCM therapist notes with immutable finalized notes
- Minimum-necessary response shapes, role/ownership checks, and append-only security audit events

Development responses expose lifecycle tokens only when `NODE_ENV` is not `production`. Connect the
email delivery outbox/provider before production. Credential documents must be uploaded through a
private, malware-scanned object-storage integration; the current endpoint registers metadata only.

## Verify

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Feature modules live in `src/modules`. Cross-cutting security controls live in `src/common`, while audit, encryption, and persistence live in `src/infrastructure`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module boundaries and persistence rules.

## Deploy on Render

Create a Render Web Service from this repository with:

- Runtime: Node
- Build command: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm build`
- Pre-deploy command: `pnpm prisma:deploy`
- Start command: `pnpm start`
- Health check path: `/api/v1/health`

Provision Render Postgres and Render Key Value in the same region. Configure `DATABASE_URL`,
`DIRECT_DATABASE_URL`, and `REDIS_URL` with their production connection strings, and set
`NODE_ENV=production`. Generate unique values for both JWT secrets and a base64-encoded 32-byte
field-encryption key. Set `ALLOWED_ORIGINS` to the deployed frontend origin and `TRUSTED_HOSTS` to
the API's Render hostname and any verified custom API domain. Render provides `PORT` automatically.

Do not process real PHI in a standard or free Render workspace. Before production health-data use,
enable a HIPAA-capable Render workspace, execute the required BAA, and complete
[the remaining readiness controls](docs/HIPAA.md).
