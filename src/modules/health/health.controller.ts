import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  status() {
    return { status: 'ok', service: 'sona-api', timestamp: new Date().toISOString() };
  }
}
