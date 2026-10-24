import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { PublicAccess } from '../authorization/access.decorators';

@Controller('health/db')
@PublicAccess()
export class DbHealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async health() {
    try {
      await this.db.ping();
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable.');
    }
  }
}
