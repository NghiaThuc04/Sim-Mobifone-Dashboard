import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type ApiConfig } from '../config';

@Injectable()
export class MutationGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: ApiConfig) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.origin !== this.config.FRONTEND_ORIGIN || !request.is('application/json')) {
      throw new ForbiddenException('Trusted Origin and JSON request required.');
    }
    return true;
  }
}
