import { Body, Controller, Get, Header, Param, Put, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';
import type { AuthenticatedRequest } from '../auth/session.service';
import { SalariesService } from './salaries.service';

@Controller('admin/employees/:id/salary')
@RequirePermission(PERMISSIONS.EMPLOYEES_ADMIN)
export class SalariesController {
  constructor(private readonly salaries: SalariesService) {}
  @Get() @Header('Cache-Control', 'no-store')
  history(@Param('id') id: string, @Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.salaries.history(id, query, request.principal.user);
  }
  @Put() @UseGuards(MutationGuard) @Header('Cache-Control', 'no-store')
  create(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.salaries.create(id, input, request.principal.user);
  }
}
