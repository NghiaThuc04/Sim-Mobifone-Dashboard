import { BadRequestException, Controller, Get, Header, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Account, hasPermission, PERMISSIONS, USER_ROLES } from '@sim-dashboard/shared';
import { z } from 'zod';
import { AuthenticatedRequest } from '../auth/session.service';
import { RequirePermission } from '../authorization/access.decorators';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';
import { calculateGrossProfit } from './sim-pricing';

const alertQuery = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

@Injectable()
export class PriceAlertsRepository {
  constructor(private readonly db: DatabaseService) {}
  list(query: z.infer<typeof alertQuery>, actor: Account) {
    const canViewCost = actor.role === USER_ROLES.ADMIN;
    const canViewDifference = hasPermission(actor, PERMISSIONS.PROFITS_VIEW);
    const where: Prisma.SimPriceAlertWhereInput = query.status === 'all' ? {} : {
      resolvedAt: query.status === 'open' ? null : { not: null },
    };
    return this.db.$transaction(async tx => {
      const total = await tx.simPriceAlert.count({ where });
      const openCount = await tx.simPriceAlert.count({ where: { resolvedAt: null } });
      const rows = await tx.simPriceAlert.findMany({
        where, include: { sim: { select: { phoneNumber: true, deletedAt: true } } },
        orderBy: [{ detectedAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      });
      return {
        items: rows.map(row => ({
          id: row.id, simId: row.simId, phoneNumber: row.sim.phoneNumber, sellingPrice: row.priceSnapshot.toString(),
          ...(canViewCost ? { costPrice: row.costSnapshot.toString() } : {}),
          ...(canViewDifference ? { difference: calculateGrossProfit(row.costSnapshot.toString(), row.priceSnapshot.toString()) } : {}),
          detectedAt: row.detectedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null,
          deletedAt: row.sim.deletedAt?.toISOString() ?? null,
        })), total, openCount, page: query.page, pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize), canViewCost, canViewDifference,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}

@Injectable()
export class PriceAlertsService {
  constructor(private readonly repository: PriceAlertsRepository, private readonly authorization: AuthorizationService) {}
  list(input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.CHECK_SIM_VIEW);
    const parsed = alertQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid alert filters or pagination.');
    return this.repository.list(parsed.data, actor);
  }
}

@Controller('admin/alerts/sim-pricing')
export class PriceAlertsController {
  constructor(private readonly alerts: PriceAlertsService) {}
  @Get() @RequirePermission(PERMISSIONS.CHECK_SIM_VIEW) @Header('Cache-Control', 'no-store')
  list(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.alerts.list(query, request.principal.user);
  }
}
