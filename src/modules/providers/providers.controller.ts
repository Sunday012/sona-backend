import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';

@ApiTags('providers')
@ApiBearerAuth()
@Controller('providers')
export class ProvidersController {
  constructor(private readonly database: DatabaseService) {}
  @Get('me') findMe(@Req() request: AuthenticatedRequest) {
    return this.database.provider.findUnique({
      where: { userId: request.user!.sub },
      select: { id: true, specialty: true, verifiedAt: true },
    });
  }
}
