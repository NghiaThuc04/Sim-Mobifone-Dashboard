import { Injectable } from '@nestjs/common';
import { type Account, type SimCheckResult } from '@sim-dashboard/shared';
import { DatabaseService } from '../database/database.service';
import { simDto } from './inventory.repository';
import { removalEligibility } from './sim-removal.policy';

@Injectable()
export class CheckSimRepository {
  constructor(private readonly db: DatabaseService) {}
  async findActive(phoneNumber: string, actor: Account): Promise<SimCheckResult> {
    const sim = await this.db.sim.findFirst({ where: { phoneNumber, deletedAt: null }, include: { carrier: true, category: true } });
    return { match: 'ACTIVE_ONLY', item: sim ? {
      ...simDto(sim, actor), orderSource: 'NOT_IMPLEMENTED',
      errorConfirmation: { verification: 'UNVERIFIED', recordedAt: sim.errorConfirmedAt?.toISOString() ?? null },
      removal: removalEligibility(actor),
    } : null };
  }
}
