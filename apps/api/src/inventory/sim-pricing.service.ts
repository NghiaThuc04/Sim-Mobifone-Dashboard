import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';

export const PRICE_ALERT_REASON = 'SELLING_NOT_ABOVE_COST';

@Injectable()
export class SimPricingService {
  constructor(private readonly audit: AuditService) {}

  // Caller owns the transaction; this lock serializes alert transitions with SIM writes.
  async reconcile(tx: Prisma.TransactionClient, simId: string, actorId: string) {
    await tx.$queryRaw`SELECT id FROM sims WHERE id=${simId}::uuid FOR UPDATE`;
    const sim = await tx.sim.findUnique({ where: { id: simId } });
    if (!sim) throw new NotFoundException('SIM not found.');
    const invalid = sim.sellingPrice.lte(sim.costPrice);
    const visible = sim.visibilityRequested && !invalid && !sim.deletedAt;
    const open = await tx.simPriceAlert.findFirst({ where: { simId, resolvedAt: null } });
    const changed = open ? !invalid || !open.costSnapshot.equals(sim.costPrice) || !open.priceSnapshot.equals(sim.sellingPrice) : invalid;
    if (invalid) {
      if (open) await tx.simPriceAlert.update({ where: { id: open.id }, data: { costSnapshot: sim.costPrice, priceSnapshot: sim.sellingPrice } });
      else await tx.simPriceAlert.create({ data: { simId, reason: PRICE_ALERT_REASON, costSnapshot: sim.costPrice, priceSnapshot: sim.sellingPrice } });
    } else if (open) {
      const [{ now }] = await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
      await tx.simPriceAlert.update({ where: { id: open.id }, data: { resolvedAt: now } });
    }
    if (sim.hasPriceError !== invalid || sim.isVisible !== visible) {
      await tx.sim.update({ where: { id: sim.id }, data: { hasPriceError: invalid, isVisible: visible, version: { increment: 1 } } });
    }
    if (changed) await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.SIM_PRICE_CHECKED,
      targetType: 'SIM', targetId: sim.id, metadata: { priceError: invalid } }, tx);
    return tx.sim.findUniqueOrThrow({ where: { id: sim.id } });
  }
}
