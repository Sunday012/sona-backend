import type { UserRole } from '../../../prisma/generated/client/client.js';

export interface RequestUser {
  sub: string;
  roles: UserRole[];
  type: 'access';
}
export interface AuthenticatedRequest {
  user?: RequestUser;
  id?: string;
  ip?: string;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
}
