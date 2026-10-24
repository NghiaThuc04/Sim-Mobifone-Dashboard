import { Controller, Get, Header, Query, Req, UnauthorizedException } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { AuthenticatedRequest } from '../auth/session.service';
import { RequirePermission } from '../authorization/access.decorators';
import { CheckSimService } from './check-sim.service';

@Controller('admin/check-sim')
export class CheckSimController {
  constructor(private readonly checkSim: CheckSimService) {}
  @Get() @RequirePermission(PERMISSIONS.CHECK_SIM_VIEW) @Header('Cache-Control', 'no-store')
  lookup(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.checkSim.lookup(query, request.principal.user);
  }
}
