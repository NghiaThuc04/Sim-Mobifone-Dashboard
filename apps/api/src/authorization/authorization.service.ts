import { ForbiddenException, Injectable } from '@nestjs/common';
import { Account, hasPermission, PERMISSIONS, Permission, USER_ROLES } from '@sim-dashboard/shared';
import type { ResourceContext } from './access.decorators';

@Injectable()
export class AuthorizationService {
  assertAllowed(account: Account, permission: Permission, resource: ResourceContext = {}): void {
    if (account.role === USER_ROLES.ADMIN) return;
    if (!hasPermission(account, permission) ||
      ((permission === PERMISSIONS.ORDERS_UPDATE_OWN || permission === PERMISSIONS.PAYROLL_VIEW_SELF || permission === PERMISSIONS.LEAVES_VIEW_SELF) && resource.ownerId !== account.id) ||
      (permission === PERMISSIONS.SIMS_DELETE_ELIGIBLE && resource.eligible !== true)) {
      throw new ForbiddenException('Permission denied.');
    }
  }
}
