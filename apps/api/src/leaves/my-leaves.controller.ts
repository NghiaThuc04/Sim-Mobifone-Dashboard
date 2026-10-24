import { Controller, Get, Header, Query, Req, UnauthorizedException } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import type { AuthenticatedRequest } from '../auth/session.service';
import { LeavesService } from './leaves.service';

@Controller('me/leaves')
@RequirePermission(PERMISSIONS.LEAVES_VIEW_SELF, (request) => ({ ownerId: request.principal?.user.id }))
export class MyLeavesController {
  constructor(private readonly leaves: LeavesService) {}
  @Get() @Header('Cache-Control', 'no-store')
  mine(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.leaves.mine(query, request.principal.user);
  }
}
