import { Body, Controller, Header, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { AuthenticatedRequest } from '../auth/session.service';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';
import { OrderCreateService } from './order-create.service';

@Controller('admin/internal-orders')
export class OrderCreateController {
  constructor(private readonly orders: OrderCreateService) {}
  @Post() @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @Header('Cache-Control', 'no-store')
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.orders.create(body, request.principal.user);
  }
}
