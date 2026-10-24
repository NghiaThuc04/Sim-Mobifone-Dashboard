import { randomUUID } from 'node:crypto';
import type { DatabaseService } from '../../src/database/database.service';

export async function orderData(db: DatabaseService, actorId: string) {
  const carrier = await db.carrier.create({ data: { code: randomUUID(), name: 'Order test carrier' } });
  const category = await db.simCategory.create({ data: { code: randomUUID(), name: 'Order test category' } });
  const sim = await db.sim.create({ data: { phoneNumber: '00' + String(BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12))),
    carrierId: carrier.id, categoryId: category.id, costPrice: '70.000000000000000000000000000001', sellingPrice: '100.000000000000000000000000000001', isVisible: true, visibilityRequested: true } });
  const customer = await db.customer.create({ data: { fullName: 'Khách kiểm thử', phone: '+8400001' } });
  const order = await db.order.create({ data: { orderCode: 'TEST-' + randomUUID(), customerId: customer.id, createdBy: actorId } });
  return { sim, customer, order };
}
