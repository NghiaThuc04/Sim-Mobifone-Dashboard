import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import type { AuthenticatedRequest } from '../auth/session.service';
import { EmployeesService } from './employees.service';
import { MutationGuard } from '../authorization/mutation.guard';

@Controller('admin/employees')
@RequirePermission(PERMISSIONS.EMPLOYEES_ADMIN)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}
  @Get(':id/permissions')
  @Header('Cache-Control', 'no-store')
  permissions(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.employees.permissions(id, request.principal.user);
  }
  @Put(':id/permissions')
  @UseGuards(MutationGuard)
  @Header('Cache-Control', 'no-store')
  setPermissions(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.employees.setPermissions(id, input, request.principal.user);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findStaff(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.employees.findStaff(id, request.principal.user);
  }
  @Post(':id/reset-password')
  @UseGuards(MutationGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  resetPassword(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.employees.resetPassword(id, input, request.principal.user);
  }
  @Patch(':id/status')
  @UseGuards(MutationGuard)
  @Header('Cache-Control', 'no-store')
  setStatus(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.employees.setStatus(id, input, request.principal.user);
  }
  @Post()
  @UseGuards(MutationGuard)
  @Header('Cache-Control', 'no-store')
  create(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.employees.create(input, request.principal.user);
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.employees.list(query, request.principal.user);
  }
}
