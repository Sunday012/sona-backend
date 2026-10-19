-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'DELETION_PENDING');

-- CreateEnum
CREATE TYPE "CommunicationMode" AS ENUM ('CHAT', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "VerificationTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "OnboardingStage" AS ENUM ('PROFILE', 'PREFERENCES', 'PROFESSIONAL_DETAILS', 'CREDENTIALS', 'AVAILABILITY', 'COMPLETE');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('PROFESSIONAL_LICENSE', 'IDENTITY_DOCUMENT', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('UPLOADED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WellnessSessionType" AS ENUM ('IMMEDIATE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "WellnessSessionStatus" AS ENUM ('QUEUED', 'MATCHING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ESCALATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IntakeCategory" AS ENUM ('ANXIETY', 'ACADEMIC_STRESS', 'RELATIONSHIPS', 'DEPRESSION', 'CAREER', 'SELF_ESTEEM', 'GENERAL_SUPPORT', 'DISTRESS');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'THERAPIST';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alias" TEXT,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3),
ADD COLUMN     "emailDomain" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "encryptedFullName" TEXT,
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT;

-- Backfill legacy development rows before enforcing the new registration invariants.
UPDATE "User"
SET "alias" = 'Legacy' || SUBSTRING(MD5("id") FROM 1 FOR 12),
    "countryCode" = 'XX',
    "emailDomain" = 'unknown.invalid',
    "encryptedFullName" = 'legacy-profile-migration-required',
    "termsAcceptedAt" = "createdAt",
    "timezone" = 'UTC';

ALTER TABLE "User" ALTER COLUMN "alias" SET NOT NULL,
ALTER COLUMN "countryCode" SET NOT NULL,
ALTER COLUMN "emailDomain" SET NOT NULL,
ALTER COLUMN "encryptedFullName" SET NOT NULL,
ALTER COLUMN "termsAcceptedAt" SET NOT NULL,
ALTER COLUMN "timezone" SET NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "ageRange" TEXT,
ADD COLUMN     "communicationPreference" "CommunicationMode",
ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStage" "OnboardingStage" NOT NULL DEFAULT 'PROFILE',
ADD COLUMN     "preferredDisplayNameCiphertext" TEXT,
ADD COLUMN     "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportGoals" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "licenseType" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStage" "OnboardingStage" NOT NULL DEFAULT 'PROFESSIONAL_DETAILS',
ADD COLUMN     "rejectionReasonCiphertext" TEXT,
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "verificationStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "yearsExperience" INTEGER;

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "VerificationTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialDocument" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" "CredentialType" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalNameCiphertext" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'UPLOADED',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT,
    "type" "WellnessSessionType" NOT NULL,
    "status" "WellnessSessionStatus" NOT NULL DEFAULT 'QUEUED',
    "intakeCategory" "IntakeCategory" NOT NULL,
    "preferredMode" "CommunicationMode" NOT NULL,
    "scrubbedContextCiphertext" TEXT,
    "crisisFlag" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapistNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "encryptionKeyVersion" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapistNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_purpose_consumedAt_idx" ON "VerificationToken"("userId", "purpose", "consumedAt");

-- CreateIndex
CREATE INDEX "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "CredentialDocument_providerId_status_idx" ON "CredentialDocument"("providerId", "status");

-- CreateIndex
CREATE INDEX "WellnessSession_patientId_createdAt_idx" ON "WellnessSession"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "WellnessSession_providerId_status_createdAt_idx" ON "WellnessSession"("providerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WellnessSession_status_queuedAt_idx" ON "WellnessSession"("status", "queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TherapistNote_sessionId_key" ON "TherapistNote"("sessionId");

-- CreateIndex
CREATE INDEX "TherapistNote_providerId_createdAt_idx" ON "TherapistNote"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_startsAt_isBooked_idx" ON "AvailabilitySlot"("startsAt", "isBooked");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_providerId_startsAt_endsAt_key" ON "AvailabilitySlot"("providerId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_alias_key" ON "User"("alias");

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialDocument" ADD CONSTRAINT "CredentialDocument_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessSession" ADD CONSTRAINT "WellnessSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessSession" ADD CONSTRAINT "WellnessSession_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistNote" ADD CONSTRAINT "TherapistNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WellnessSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistNote" ADD CONSTRAINT "TherapistNote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
