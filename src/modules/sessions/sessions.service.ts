import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  UserRole,
  WellnessSessionStatus,
  WellnessSessionType,
} from '../../../prisma/generated/client/client.js';
import { containsCrisisLanguage, scrubDirectIdentifiers } from '../../common/security/clinical-text.js';
import { AuditService } from '../../infrastructure/audit/audit.service.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service.js';
import type { RequestImmediateSessionDto, SaveTherapistNoteDto } from './sessions.dto.js';

@Injectable()
export class SessionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async requestImmediate(userId: string, input: RequestImmediateSessionDto) {
    const patient = await this.database.patient.findUnique({
      where: { userId },
      include: { user: { select: { status: true } } },
    });
    if (!patient || patient.user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('An active patient account is required');
    }
    const scrubbed = input.context ? scrubDirectIdentifiers(input.context) : undefined;
    const crisisFlag = scrubbed ? containsCrisisLanguage(scrubbed) : false;
    const session = await this.database.wellnessSession.create({
      data: {
        patientId: patient.id,
        type: WellnessSessionType.IMMEDIATE,
        status: crisisFlag ? WellnessSessionStatus.ESCALATED : WellnessSessionStatus.QUEUED,
        intakeCategory: input.category,
        preferredMode: input.preferredMode,
        scrubbedContextCiphertext: scrubbed ? this.encryption.encrypt(scrubbed) : undefined,
        crisisFlag,
      },
      select: { id: true, status: true, preferredMode: true, crisisFlag: true, queuedAt: true },
    });
    await this.audit.write({
      actorId: userId,
      action: crisisFlag ? 'session.crisis_flagged' : 'session.queued',
      resourceType: 'wellness_session',
      resourceId: session.id,
      outcome: 'success',
    });
    return {
      ...session,
      ...(crisisFlag
        ? {
            crisisSupportRequired: true,
            message:
              'Sona is not an emergency service. Contact local emergency services or a crisis line now.',
          }
        : {}),
    };
  }

  listForPatient(userId: string) {
    return this.database.wellnessSession.findMany({
      where: { patient: { userId } },
      select: {
        id: true,
        type: true,
        status: true,
        intakeCategory: true,
        preferredMode: true,
        scheduledFor: true,
        queuedAt: true,
        startedAt: true,
        endedAt: true,
        rating: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async therapistQueue(userId: string) {
    const therapist = await this.requireVerifiedTherapist(userId);
    return this.database.wellnessSession.findMany({
      where: {
        status: WellnessSessionStatus.QUEUED,
        providerId: null,
        patient: { user: { countryCode: therapist.countryCode ?? undefined } },
      },
      select: {
        id: true,
        intakeCategory: true,
        preferredMode: true,
        queuedAt: true,
        patient: { select: { user: { select: { alias: true } } } },
      },
      orderBy: { queuedAt: 'asc' },
      take: 50,
    });
  }

  async accept(userId: string, sessionId: string) {
    const therapist = await this.requireVerifiedTherapist(userId);
    const result = await this.database.wellnessSession.updateMany({
      where: { id: sessionId, status: WellnessSessionStatus.QUEUED, providerId: null },
      data: {
        providerId: therapist.id,
        status: WellnessSessionStatus.ACTIVE,
        matchedAt: new Date(),
        startedAt: new Date(),
      },
    });
    if (result.count !== 1) throw new ConflictException('Session is no longer available');
    await this.audit.write({
      actorId: userId,
      action: 'session.accepted',
      resourceType: 'wellness_session',
      resourceId: sessionId,
      outcome: 'success',
    });
    return this.sessionSummary(sessionId);
  }

  async end(userId: string, roles: UserRole[], sessionId: string) {
    await this.requireParticipant(userId, roles, sessionId);
    const result = await this.database.wellnessSession.updateMany({
      where: { id: sessionId, status: WellnessSessionStatus.ACTIVE },
      data: { status: WellnessSessionStatus.COMPLETED, endedAt: new Date() },
    });
    if (result.count !== 1) throw new ConflictException('Only an active session can be ended');
    await this.audit.write({
      actorId: userId,
      action: 'session.ended',
      resourceType: 'wellness_session',
      resourceId: sessionId,
      outcome: 'success',
    });
    return this.sessionSummary(sessionId);
  }

  async escalate(userId: string, roles: UserRole[], sessionId: string) {
    await this.requireParticipant(userId, roles, sessionId);
    const result = await this.database.wellnessSession.updateMany({
      where: { id: sessionId, status: WellnessSessionStatus.ACTIVE },
      data: { status: WellnessSessionStatus.ESCALATED, crisisFlag: true, endedAt: new Date() },
    });
    if (result.count !== 1) throw new ConflictException('Only an active session can be escalated');
    await this.audit.write({
      actorId: userId,
      action: 'session.escalated',
      resourceType: 'wellness_session',
      resourceId: sessionId,
      outcome: 'success',
    });
    return {
      id: sessionId,
      status: WellnessSessionStatus.ESCALATED,
      message: 'Sona is not an emergency service. Contact local emergency services or a crisis line now.',
    };
  }

  async rate(userId: string, sessionId: string, rating: number) {
    const result = await this.database.wellnessSession.updateMany({
      where: { id: sessionId, patient: { userId }, status: WellnessSessionStatus.COMPLETED },
      data: { rating },
    });
    if (result.count !== 1) throw new NotFoundException('Completed session not found');
    return { id: sessionId, rating };
  }

  async saveNote(userId: string, sessionId: string, input: SaveTherapistNoteDto) {
    const therapist = await this.requireVerifiedTherapist(userId);
    const session = await this.database.wellnessSession.findFirst({
      where: { id: sessionId, providerId: therapist.id },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Assigned session not found');
    const existing = await this.database.therapistNote.findUnique({
      where: { sessionId },
      select: { finalizedAt: true },
    });
    if (existing?.finalizedAt) throw new ConflictException('Finalized notes cannot be edited');
    const note = await this.database.therapistNote.upsert({
      where: { sessionId },
      create: {
        sessionId,
        providerId: therapist.id,
        encryptedPayload: this.encryption.encrypt(input.note),
        encryptionKeyVersion: 'local-v1',
        finalizedAt: input.finalized ? new Date() : undefined,
      },
      update: {
        encryptedPayload: this.encryption.encrypt(input.note),
        finalizedAt: input.finalized ? new Date() : undefined,
      },
      select: { id: true, sessionId: true, finalizedAt: true, updatedAt: true },
    });
    await this.audit.write({
      actorId: userId,
      action: input.finalized ? 'session.note_finalized' : 'session.note_saved',
      resourceType: 'therapist_note',
      resourceId: note.id,
      outcome: 'success',
    });
    return note;
  }

  private sessionSummary(id: string) {
    return this.database.wellnessSession.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, preferredMode: true, matchedAt: true, startedAt: true },
    });
  }

  private async requireVerifiedTherapist(userId: string) {
    const therapist = await this.database.provider.findUnique({ where: { userId } });
    if (!therapist || therapist.verificationStatus !== AccountStatus.VERIFIED) {
      throw new ForbiddenException('Verified therapist access is required');
    }
    return therapist;
  }

  private async requireParticipant(userId: string, roles: UserRole[], sessionId: string) {
    const where = roles.includes(UserRole.THERAPIST)
      ? { id: sessionId, provider: { userId } }
      : { id: sessionId, patient: { userId } };
    const session = await this.database.wellnessSession.findFirst({ where, select: { id: true } });
    if (!session) throw new NotFoundException('Session not found');
  }
}
