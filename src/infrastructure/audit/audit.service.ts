import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface WriteAuditEvent {
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: 'success' | 'failure';
  purpose?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, string | number | boolean>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AUDIT');
  constructor(private readonly database: DatabaseService) {}

  async write(event: WriteAuditEvent): Promise<void> {
    await this.database.auditEvent.create({ data: event });
    this.logger.log(JSON.stringify({ ...event, kind: 'security_audit' }));
  }
}
