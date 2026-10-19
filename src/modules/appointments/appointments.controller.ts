import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audited } from '../../common/decorators/audit.decorator.js';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly database: DatabaseService) {}
  @Get(':id')
  @Audited({ action: 'appointment.read', resourceType: 'appointment', phi: true })
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.database.appointment.findFirst({
      where: {
        id,
        OR: [{ patient: { userId: request.user!.sub } }, { provider: { userId: request.user!.sub } }],
      },
      select: { id: true, patientId: true, providerId: true, startsAt: true, endsAt: true, status: true },
    });
  }
}
