import { Body, Controller, Get, Header, Param, Put, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';
import type { AuthenticatedRequest } from '../auth/session.service';
import { CommissionsService } from './commissions.service';

@Controller('admin/employees/:id')
@RequirePermission(PERMISSIONS.EMPLOYEES_ADMIN)
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}
  @Get('commission-policy')
  @Header('Cache-Control', 'no-store')
  history(@Param('id') id: string, @Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.commissions.history(id, query, request.principal.user);
  }
  @Put('commission-policy')
  @UseGuards(MutationGuard)
  @Header('Cache-Control', 'no-store')
  create(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.commissions.create(id, input, request.principal.user);
  }
}
