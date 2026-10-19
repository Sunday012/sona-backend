import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountStatus, CredentialStatus, UserRole } from '../../../prisma/generated/client/client.js';
import { Audited } from '../../common/decorators/audit.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import { AuditService } from '../../infrastructure/audit/audit.service.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service.js';
import { RejectTherapistDto } from './admin.dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  @Get('therapists/pending')
  @Audited({ action: 'admin.therapists_pending', resourceType: 'therapist', phi: true })
  pendingTherapists() {
    return this.database.provider.findMany({
      where: { verificationStatus: { in: [AccountStatus.PENDING_REVIEW, AccountStatus.UNDER_REVIEW] } },
      select: {
        id: true,
        licenseType: true,
        specialty: true,
        yearsExperience: true,
        specializations: true,
        languages: true,
        countryCode: true,
        verificationStatus: true,
        createdAt: true,
        credentials: { select: { id: true, type: true, objectKey: true, mimeType: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('therapists/:id/approve')
  async approve(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const reviewedAt = new Date();
    const therapist = await this.database.provider.findUniqueOrThrow({
      where: { id },
      select: { userId: true },
    });
    await this.database.$transaction([
      this.database.provider.update({
        where: { id },
        data: {
          verificationStatus: AccountStatus.VERIFIED,
          verifiedAt: reviewedAt,
          reviewedById: request.user!.sub,
          rejectionReasonCiphertext: null,
          credentials: { updateMany: { where: {}, data: { status: CredentialStatus.APPROVED, reviewedAt } } },
        },
      }),
      this.database.user.update({
        where: { id: therapist.userId },
        data: { status: AccountStatus.VERIFIED },
      }),
    ]);
    await this.audit.write({
      actorId: request.user!.sub,
      action: 'therapist.approved',
      resourceType: 'therapist',
      resourceId: id,
      outcome: 'success',
    });
    return { id, status: AccountStatus.VERIFIED, reviewedAt };
  }

  @Post('therapists/:id/reject')
  async reject(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: RejectTherapistDto,
  ) {
    const reviewedAt = new Date();
    const therapist = await this.database.provider.findUniqueOrThrow({
      where: { id },
      select: { userId: true },
    });
    await this.database.$transaction([
      this.database.provider.update({
        where: { id },
        data: {
          verificationStatus: AccountStatus.REJECTED,
          reviewedById: request.user!.sub,
          rejectionReasonCiphertext: this.encryption.encrypt(input.reason),
          isAvailable: false,
          credentials: { updateMany: { where: {}, data: { status: CredentialStatus.REJECTED, reviewedAt } } },
        },
      }),
      this.database.user.update({
        where: { id: therapist.userId },
        data: { status: AccountStatus.REJECTED },
      }),
    ]);
    await this.audit.write({
      actorId: request.user!.sub,
      action: 'therapist.rejected',
      resourceType: 'therapist',
      resourceId: id,
      outcome: 'success',
    });
    return { id, status: AccountStatus.REJECTED, reviewedAt };
  }
}
