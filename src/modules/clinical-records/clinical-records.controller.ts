import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../prisma/generated/client/client.js';
import { Audited } from '../../common/decorators/audit.decorator.js';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';

@ApiTags('clinical records')
@ApiBearerAuth()
@Controller('clinical-records')
export class ClinicalRecordsController {
  constructor(private readonly database: DatabaseService) {}
  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.PROVIDER)
  @Audited({ action: 'clinical_record.read', resourceType: 'clinical_record', phi: true })
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.database.clinicalRecord.findFirst({
      where: {
        id,
        OR: [{ patient: { userId: request.user!.sub } }, { author: { userId: request.user!.sub } }],
      },
      select: { id: true, patientId: true, authorProviderId: true, recordType: true, createdAt: true },
    });
  }
}
