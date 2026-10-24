import { ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { InternalOrderCreateResult } from '@sim-dashboard/shared';
import { DatabaseService } from '../database/database.service';
import { ReservationsService } from './reservations.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { orderCreateResult, type InternalOrderInput } from './orders.input';

@Injectable()
export class OrderCreateRepository {
  constructor(private readonly db: DatabaseService, private readonly reservations: ReservationsService, private readonly audit: AuditService) {}
  create(input: InternalOrderInput, actorId: string): Promise<InternalOrderCreateResult> {
    const { idempotencyKey, ...payload } = input;
    const requestHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actorId + ':' + idempotencyKey},0))`;
      const previous = await tx.orderCreateKey.findUnique({ where: { actorId_idempotencyKey: { actorId, idempotencyKey } } });
      if (previous) {
        if (previous.requestHash !== requestHash) throw new ConflictException('Idempotency key was already used with different input.');
        return orderCreateResult.parse(previous.response);
      }
      const customer = await tx.customer.create({ data: input.customer });
      const order = await tx.order.create({ data: { orderCode: 'ORD-' + randomUUID(), customerId: customer.id, createdBy: actorId } });
      const { reservation, sim } = await this.reservations.reserve(tx, order.id, input.simId);
      await tx.orderItem.create({ data: { orderId: order.id, simId: sim.id, phoneNumberSnapshot: sim.phoneNumber,
        sellingPriceSnapshot: sim.sellingPrice, costPriceSnapshot: sim.costPrice } });
      const response = orderCreateResult.parse({ id: order.id, orderCode: order.orderCode, status: order.status });
      await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.ORDER_CREATED, targetType: 'ORDER', targetId: order.id,
        metadata: { orderCode: order.orderCode, simId: sim.id, reservationId: reservation.id } }, tx);
      await tx.orderCreateKey.create({ data: { actorId, idempotencyKey, requestHash, orderId: order.id, response } });
      return response;
    });
  }
}
