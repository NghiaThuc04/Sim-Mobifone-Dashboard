import { Body, Controller, Get, Patch, Post, UseGuards, Header, Param, Query, Req, UnauthorizedException } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { AuthenticatedRequest } from '../auth/session.service';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post(':id/assign') @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  assign(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.orders.assign(id,input,request.principal);
  }
  @Patch(':id/status') @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  status(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.orders.status(id,input,request.principal);
  }
  @Post(':id/claim') @RequirePermission(PERMISSIONS.ORDERS_CLAIM) @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  claim(@Param('id') id: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.orders.claim(id,input,request.principal);
  }
  @Get(':id') @RequirePermission(PERMISSIONS.ORDERS_VIEW) @Header('Cache-Control', 'no-store')
  detail(@Param('id') id: string, @Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.orders.detail(id, query, request.principal.user);
  }
  @Get() @RequirePermission(PERMISSIONS.ORDERS_VIEW) @Header('Cache-Control', 'no-store')
  list(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.orders.list(query, request.principal.user);
  }
}
