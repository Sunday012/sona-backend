import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnboardingStage, UserRole } from '../../../prisma/generated/client/client.js';
import { Audited } from '../../common/decorators/audit.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service.js';
import {
  CreateAvailabilitySlotDto,
  RegisterCredentialDto,
  UpdateTherapistProfileDto,
} from './therapists.dto.js';

@ApiTags('therapists')
@ApiBearerAuth()
@Controller('therapists')
@Roles(UserRole.THERAPIST)
export class TherapistsController {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptionService,
  ) {}

  @Get('me')
  @Audited({ action: 'therapist.read', resourceType: 'therapist', phi: true })
  findMe(@Req() request: AuthenticatedRequest) {
    return this.database.provider.findUniqueOrThrow({
      where: { userId: request.user!.sub },
      select: {
        id: true,
        specialty: true,
        licenseType: true,
        yearsExperience: true,
        specializations: true,
        languages: true,
        countryCode: true,
        timezone: true,
        isAvailable: true,
        onboardingStage: true,
        onboardingCompletedAt: true,
        verificationStatus: true,
        verifiedAt: true,
        credentials: { select: { id: true, type: true, status: true, createdAt: true } },
      },
    });
  }

  @Patch('me')
  @Audited({ action: 'therapist.update', resourceType: 'therapist', phi: true })
  updateMe(@Req() request: AuthenticatedRequest, @Body() input: UpdateTherapistProfileDto) {
    const { completeOnboarding, ...profile } = input;
    return this.database.provider.update({
      where: { userId: request.user!.sub },
      data: {
        ...profile,
        onboardingStage: completeOnboarding ? OnboardingStage.COMPLETE : OnboardingStage.PROFESSIONAL_DETAILS,
        onboardingCompletedAt: completeOnboarding ? new Date() : undefined,
      },
      select: {
        id: true,
        specialty: true,
        yearsExperience: true,
        specializations: true,
        languages: true,
        isAvailable: true,
        onboardingStage: true,
        onboardingCompletedAt: true,
        verificationStatus: true,
      },
    });
  }

  @Post('me/credentials')
  @Audited({ action: 'therapist.credential_registered', resourceType: 'credential', phi: true })
  async registerCredential(@Req() request: AuthenticatedRequest, @Body() input: RegisterCredentialDto) {
    const provider = await this.database.provider.findUniqueOrThrow({
      where: { userId: request.user!.sub },
      select: { id: true },
    });
    return this.database.credentialDocument.create({
      data: {
        providerId: provider.id,
        type: input.type,
        objectKey: input.objectKey,
        originalNameCiphertext: this.encryption.encrypt(input.originalName),
        mimeType: input.mimeType,
        checksum: input.checksum.toLowerCase(),
      },
      select: { id: true, type: true, status: true, createdAt: true },
    });
  }

  @Get('me/availability')
  async availability(@Req() request: AuthenticatedRequest) {
    const provider = await this.database.provider.findUniqueOrThrow({
      where: { userId: request.user!.sub },
      select: { id: true },
    });
    return this.database.availabilitySlot.findMany({
      where: { providerId: provider.id, endsAt: { gte: new Date() } },
      select: { id: true, startsAt: true, endsAt: true, isBooked: true },
      orderBy: { startsAt: 'asc' },
    });
  }

  @Post('me/availability')
  async createAvailability(@Req() request: AuthenticatedRequest, @Body() input: CreateAvailabilitySlotDto) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt <= new Date() || endsAt <= startsAt) {
      throw new BadRequestException('Availability must be a valid future time range');
    }
    const provider = await this.database.provider.findUniqueOrThrow({
      where: { userId: request.user!.sub },
      select: { id: true },
    });
    return this.database.availabilitySlot.create({
      data: { providerId: provider.id, startsAt, endsAt },
      select: { id: true, startsAt: true, endsAt: true, isBooked: true },
    });
  }

  @Delete('me/availability/:id')
  async deleteAvailability(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.database.availabilitySlot.deleteMany({
      where: { id, provider: { userId: request.user!.sub }, isBooked: false },
    });
    if (result.count !== 1) throw new NotFoundException('Available slot not found');
  }
}
