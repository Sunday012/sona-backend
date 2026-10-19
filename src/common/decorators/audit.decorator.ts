import { SetMetadata } from '@nestjs/common';

export interface AuditMetadata {
  action: string;
  resourceType: string;
  phi?: boolean;
}
export const AUDIT_METADATA = 'auditMetadata';
export const Audited = (metadata: AuditMetadata) => SetMetadata(AUDIT_METADATA, metadata);
