import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@sim-dashboard/shared';
import type { AuthenticatedRequest } from '../auth/session.service';

export const PUBLIC_ACCESS = Symbol('PUBLIC_ACCESS');
export const REQUIRED_PERMISSION = Symbol('REQUIRED_PERMISSION');
export type ResourceContext = { ownerId?: string; eligible?: boolean };
export type PermissionPolicy = {
  permission: Permission;
  resolveResource?: (request: AuthenticatedRequest) => Promise<ResourceContext> | ResourceContext;
};
export const PublicAccess = () => SetMetadata(PUBLIC_ACCESS, true);
export const RequirePermission = (permission: Permission, resolveResource?: PermissionPolicy['resolveResource']) =>
  SetMetadata(REQUIRED_PERMISSION, { permission, resolveResource } satisfies PermissionPolicy);
