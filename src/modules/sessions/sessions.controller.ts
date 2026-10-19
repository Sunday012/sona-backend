import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../prisma/generated/client/client.js';
import { Audited } from '../../common/decorators/audit.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import { RateSessionDto, RequestImmediateSessionDto, SaveTherapistNoteDto } from './sessions.dto.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('wellness sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('request')
  @Roles(UserRole.PATIENT)
  @Audited({ action: 'session.request', resourceType: 'wellness_session', phi: true })
  request(@Req() request: AuthenticatedRequest, @Body() input: RequestImmediateSessionDto) {
    return this.sessions.requestImmediate(request.user!.sub, input);
  }

  @Get()
  @Roles(UserRole.PATIENT)
  list(@Req() request: AuthenticatedRequest) {
    return this.sessions.listForPatient(request.user!.sub);
  }

  @Get('queue')
  @Roles(UserRole.THERAPIST)
  queue(@Req() request: AuthenticatedRequest) {
    return this.sessions.therapistQueue(request.user!.sub);
  }

  @Post(':id/accept')
  @Roles(UserRole.THERAPIST)
  accept(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.sessions.accept(request.user!.sub, id);
  }

  @Post(':id/end')
  @Roles(UserRole.PATIENT, UserRole.THERAPIST)
  end(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.sessions.end(request.user!.sub, request.user!.roles, id);
  }

  @Post(':id/escalate')
  @Roles(UserRole.PATIENT, UserRole.THERAPIST)
  escalate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.sessions.escalate(request.user!.sub, request.user!.roles, id);
  }

  @Post(':id/rate')
  @Roles(UserRole.PATIENT)
  rate(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: RateSessionDto) {
    return this.sessions.rate(request.user!.sub, id, input.rating);
  }

  @Post(':id/notes')
  @Roles(UserRole.THERAPIST)
  @Audited({ action: 'session.note_write', resourceType: 'therapist_note', phi: true })
  saveNote(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: SaveTherapistNoteDto,
  ) {
    return this.sessions.saveNote(request.user!.sub, id, input);
  }
}
