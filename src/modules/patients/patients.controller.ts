import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnboardingStage, UserRole } from '../../../prisma/generated/client/client.js';
import { Audited } from '../../common/decorators/audit.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service.js';
import { UpdatePatientProfileDto } from './patients.dto.js';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
@Roles(UserRole.PATIENT)
export class PatientsController {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptionService,
  ) {}
  @Get('me')
  @Audited({ action: 'patient.read', resourceType: 'patient', phi: true })
  findMe(@Req() request: AuthenticatedRequest) {
    return this.database.patient.findUnique({
      where: { userId: request.user!.sub },
      select: {
        id: true,
        medicalRecordNumber: true,
        ageRange: true,
        communicationPreference: true,
        supportGoals: true,
        emailNotifications: true,
        pushNotifications: true,
        onboardingStage: true,
        onboardingCompletedAt: true,
        createdAt: true,
      },
    });
  }

  @Patch('me')
  @Audited({ action: 'patient.update', resourceType: 'patient', phi: true })
  updateMe(@Req() request: AuthenticatedRequest, @Body() input: UpdatePatientProfileDto) {
    const { preferredDisplayName, completeOnboarding, ...profile } = input;
    return this.database.patient.update({
      where: { userId: request.user!.sub },
      data: {
        ...profile,
        preferredDisplayNameCiphertext: preferredDisplayName
          ? this.encryption.encrypt(preferredDisplayName)
          : undefined,
        onboardingStage: completeOnboarding ? OnboardingStage.COMPLETE : OnboardingStage.PREFERENCES,
        onboardingCompletedAt: completeOnboarding ? new Date() : undefined,
      },
      select: {
        id: true,
        ageRange: true,
        communicationPreference: true,
        supportGoals: true,
        emailNotifications: true,
        pushNotifications: true,
        onboardingStage: true,
        onboardingCompletedAt: true,
      },
    });
  }
}
