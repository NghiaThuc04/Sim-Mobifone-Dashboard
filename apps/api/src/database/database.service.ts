import { OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type { ApiConfig } from '../config';

export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ApiConfig) {
    const connection = new URL(config.DATABASE_URL);
    // adapter-pg serializes and normalizes timestamps as UTC; bind that requirement on every pooled connection.
    connection.searchParams.set('options', `${connection.searchParams.get('options') ?? ''} -c timezone=UTC`.trim());
    super({ adapter: new PrismaPg({
      connectionString: connection.toString(),
      max: 5,
      connectionTimeoutMillis: 2000,
      query_timeout: 3000,
      idleTimeoutMillis: 10000,
    }), log: [] });
  }

  async ping(): Promise<void> { await this.$queryRaw`SELECT 1`; }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
