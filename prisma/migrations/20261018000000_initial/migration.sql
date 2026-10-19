CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'PROVIDER', 'ADMIN', 'PRIVACY_OFFICER');
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "emailBlindIndex" TEXT NOT NULL, "encryptedEmail" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL, "roles" "UserRole"[] DEFAULT ARRAY['PATIENT']::"UserRole"[],
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT false, "encryptedMfaSecret" TEXT,
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0, "lockedUntil" TIMESTAMP(3), "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Patient" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "medicalRecordNumber" TEXT NOT NULL,
  "encryptedFirstName" TEXT NOT NULL, "encryptedLastName" TEXT NOT NULL, "encryptedPhone" TEXT,
  "dateOfBirth" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Provider" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "encryptedDisplayName" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL, "specialty" TEXT, "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL, "patientId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED', "reasonCiphertext" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClinicalRecord" (
  "id" TEXT NOT NULL, "patientId" TEXT NOT NULL, "authorProviderId" TEXT NOT NULL,
  "recordType" TEXT NOT NULL, "encryptedPayload" TEXT NOT NULL, "encryptionKeyVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RefreshSession" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3), "replacedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL, "resourceType" TEXT NOT NULL,
  "resourceId" TEXT, "outcome" TEXT NOT NULL, "purpose" TEXT, "requestId" TEXT, "ipAddress" TEXT,
  "userAgent" TEXT, "metadata" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BreakGlassGrant" (
  "id" TEXT NOT NULL, "actorId" TEXT NOT NULL, "patientId" TEXT NOT NULL, "reasonCode" TEXT NOT NULL,
  "encryptedJustification" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BreakGlassGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_emailBlindIndex_key" ON "User"("emailBlindIndex");
CREATE INDEX "User_roles_idx" ON "User"("roles");
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");
CREATE UNIQUE INDEX "Patient_medicalRecordNumber_key" ON "Patient"("medicalRecordNumber");
CREATE UNIQUE INDEX "Provider_userId_key" ON "Provider"("userId");
CREATE UNIQUE INDEX "Provider_licenseNumber_key" ON "Provider"("licenseNumber");
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");
CREATE INDEX "Appointment_providerId_startsAt_idx" ON "Appointment"("providerId", "startsAt");
CREATE INDEX "ClinicalRecord_patientId_createdAt_idx" ON "ClinicalRecord"("patientId", "createdAt");
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE INDEX "RefreshSession_userId_revokedAt_idx" ON "RefreshSession"("userId", "revokedAt");
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");
CREATE INDEX "AuditEvent_actorId_occurredAt_idx" ON "AuditEvent"("actorId", "occurredAt");
CREATE INDEX "AuditEvent_resourceType_resourceId_occurredAt_idx" ON "AuditEvent"("resourceType", "resourceId", "occurredAt");
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");
CREATE INDEX "BreakGlassGrant_actorId_expiresAt_idx" ON "BreakGlassGrant"("actorId", "expiresAt");
CREATE INDEX "BreakGlassGrant_patientId_createdAt_idx" ON "BreakGlassGrant"("patientId", "createdAt");
CREATE INDEX "BreakGlassGrant_reviewedAt_idx" ON "BreakGlassGrant"("reviewedAt");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_authorProviderId_fkey" FOREIGN KEY ("authorProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_audit_event_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit events are append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_event_no_update_delete BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();
