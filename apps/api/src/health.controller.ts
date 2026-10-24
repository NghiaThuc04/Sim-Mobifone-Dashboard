import { Controller, Get, Header } from '@nestjs/common';
import { HEALTH_STATUS, type HealthResponse } from '@sim-dashboard/shared';
import { PublicAccess } from './authorization/access.decorators';

@Controller('health')
@PublicAccess()
export class HealthController {
  @Get()
  @Header('Cache-Control', 'no-store')
  health(): HealthResponse {
    return { status: HEALTH_STATUS };
  }
}
