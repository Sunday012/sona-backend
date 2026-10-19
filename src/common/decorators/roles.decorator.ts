import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../../prisma/generated/client/client.js';

export const ROLES = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);
