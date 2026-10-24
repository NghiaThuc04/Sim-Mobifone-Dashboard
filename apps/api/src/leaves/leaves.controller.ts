import { Body, Controller, Get, Header, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';
import type { AuthenticatedRequest } from '../auth/session.service';
import { LeavesService } from './leaves.service';

@Controller('admin/employees/:id/leaves')
@RequirePermission(PERMISSIONS.EMPLOYEES_ADMIN)
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}
  @Get() @Header('Cache-Control', 'no-store')
  list(@Param('id') id: string, @Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.leaves.list(id, query, request.principal.user);
  }
  @Post() @UseGuards(MutationGuard) @Header('Cache-Control', 'no-store')
  create(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.leaves.create(id, input, request.principal.user);
  }
}
