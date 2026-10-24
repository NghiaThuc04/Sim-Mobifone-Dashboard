import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class ReservationsService {
  // The caller owns creation and rollback of the draft order and its snapshots in this transaction.
  async reserve(tx: Prisma.TransactionClient, orderId: string, simId: string) {
    if (!z.uuid().safeParse(orderId).success || !z.uuid().safeParse(simId).success) throw new BadRequestException('Invalid order or SIM id.');
    await tx.$queryRaw`SELECT id FROM orders WHERE id=${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Draft order not found.');
    if (order.status !== 'PENDING') throw new ConflictException('Order is not a pending draft.');
    await tx.$queryRaw`SELECT id FROM sims WHERE id=${simId}::uuid FOR UPDATE`;
    const sim = await tx.sim.findUnique({ where: { id: simId } });
    if (!sim || sim.deletedAt || !sim.isVisible || sim.hasPriceError || sim.sellingPrice.lte(sim.costPrice) || sim.stockStatus !== 'AVAILABLE')
      throw new ConflictException('SIM is no longer available.');
    if (await tx.inventoryReservation.findFirst({ where: { releasedAt: null, OR: [{ simId }, { phoneNumberSnapshot: sim.phoneNumber }] } }))
      throw new ConflictException('SIM already has an active reservation.');
    const reservation = await tx.inventoryReservation.create({ data: { orderId, simId, phoneNumberSnapshot: sim.phoneNumber } });
    await tx.sim.update({ where: { id: simId, version: sim.version }, data: { stockStatus: 'RESERVED', version: { increment: 1 } } });
    return { reservation, sim };
  }
}
