import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { USER_ROLES } from '@sim-dashboard/shared';
import { SessionService, type AuthenticatedRequest } from '../auth/session.service';
import { PUBLIC_ACCESS, REQUIRED_PERMISSION, type PermissionPolicy } from './access.decorators';
import { AuthorizationService } from './authorization.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ACCESS, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.principal = await this.sessions.resolve(request.headers.cookie);
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<PermissionPolicy>(REQUIRED_PERMISSION, [context.getHandler(), context.getClass()]);
    if (!policy) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    const user = request.principal.user;
    const resource = user.role !== USER_ROLES.ADMIN && policy.resolveResource ? await policy.resolveResource(request) : {};
    try { this.authorization.assertAllowed(user, policy.permission, resource); }
    catch (error) {
      if (error instanceof ForbiddenException) await this.audit.append({ actorKind: 'USER', actorId: user.id,
        action: AUDIT_ACTIONS.ACCESS_DENIED, targetType: 'ACCESS', metadata: { permission: policy.permission, reason: 'permission_denied' } });
      throw error;
    }
    return true;
  }
}
