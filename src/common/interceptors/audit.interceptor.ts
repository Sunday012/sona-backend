import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, concatMap, from, map, Observable, throwError } from 'rxjs';
import { AUDIT_METADATA, type AuditMetadata } from '../decorators/audit.decorator.js';
import type { AuthenticatedRequest } from '../security/request-user.js';
import { AuditService } from '../../infrastructure/audit/audit.service.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(AUDIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!metadata) return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const write = (outcome: 'success' | 'failure') =>
      this.audit.write({
        actorId: request.user?.sub,
        action: metadata.action,
        resourceType: metadata.resourceType,
        resourceId: request.params?.id,
        outcome,
        requestId: request.id,
        ipAddress: request.ip,
        userAgent: String(request.headers['user-agent'] ?? ''),
        metadata: {
          phi: Boolean(metadata.phi),
          method: request.method,
          path: request.url.split('?')[0] ?? request.url,
        },
      });
    return next.handle().pipe(
      concatMap((value: unknown) => from(write('success')).pipe(map(() => value))),
      catchError((error: unknown) => {
        return from(write('failure').catch(() => undefined)).pipe(concatMap(() => throwError(() => error)));
      }),
    );
  }
}
