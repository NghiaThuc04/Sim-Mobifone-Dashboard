import { Injectable, NotFoundException } from '@nestjs/common';
import { type Account, type OrderList, type OrderDetail, USER_ROLES } from '@sim-dashboard/shared';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { monthBounds } from '../common/calendar';
import type { OrdersQuery } from './orders.input';

@Injectable()
export class OrdersRepository {
  constructor(private readonly db: DatabaseService) {}
  private async completion(tx: Prisma.TransactionClient, id: string, needsDecision: boolean): Promise<OrderDetail['completion']> {
    const row = await tx.orderCompletion.findUnique({where:{orderId:id}});
    return row ? {completedAt:row.completedAt.toISOString(),completedBy:row.completedBy,approvalStatus:'PENDING_APPROVAL',
      rateEmployeeId:row.rateEmployeeId,ratePolicyId:row.ratePolicyId,rateSnapshot:row.rateSnapshot?.toString() ?? null,policyEffectiveAt:row.policyEffectiveAt?.toISOString() ?? null,
      beneficiaryId:needsDecision?null:row.beneficiaryId,beneficiaryState:needsDecision?'UNRESOLVED':row.beneficiaryId?'RESOLVED':'UNRESOLVED'} : null;
  }
  async detail(id: string, itemPage: number, actor: Account): Promise<OrderDetail> {
    const canViewCost = actor.role === USER_ROLES.ADMIN;
    return this.db.$transaction(async tx => {
      const row = await tx.order.findUnique({ where: { id }, select: {
        id: true, orderCode: true, status: true, createdAt: true, assignedStaffId: true, claimedAt: true, beneficiaryNeedsDecision: true, completedAt: true, completedBy: true,
        customer: { select: { fullName: true, phone: true } }, _count: { select: { items: true } },
        items: { orderBy: { id: 'asc' }, skip: (itemPage - 1) * 50, take: 50, select: {
          id: true, simId: true, phoneNumberSnapshot: true, sellingPriceSnapshot: true, ...(canViewCost ? { costPriceSnapshot: true } : {}) } },
      } });
      if (!row) throw new NotFoundException('Order not found.');
      const staff = row.assignedStaffId ? await tx.user.findUnique({ where: { id: row.assignedStaffId }, select: { fullName: true } }) : null;
      return { id: row.id, orderCode: row.orderCode, status: row.status, createdAt: row.createdAt.toISOString(), customer: row.customer,
        assignedStaff: row.assignedStaffId ? { id: row.assignedStaffId, fullName: staff?.fullName ?? null } : null,
        beneficiaryNeedsDecision: row.beneficiaryNeedsDecision, claimedAt: row.claimedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null, completedBy: row.completedBy, canViewCost,
        items: row.items.map(item => ({ id: item.id, simId: item.simId, phoneNumber: item.phoneNumberSnapshot,
          sellingPrice: item.sellingPriceSnapshot.toString(), ...(canViewCost ? { costPrice: item.costPriceSnapshot?.toString() } : {}) })),
        assignmentHistory: (await tx.orderAssignmentHistory.findMany({where:{orderId:id},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(itemPage-1)*50,take:50})).map(event=>({id:event.id,previousStaffId:event.previousStaffId,assignedStaffId:event.assignedStaffId,actorId:event.actorId,action:event.action,reason:event.reason,createdAt:event.createdAt.toISOString()})),
        completion: await this.completion(tx,id,row.beneficiaryNeedsDecision),
        statusHistory: (await tx.orderStatusHistory.findMany({where:{orderId:id},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(itemPage-1)*50,take:50})).map(event=>({id:event.id,actorId:event.actorId,previousStatus:event.previousStatus,status:event.status,createdAt:event.createdAt.toISOString()})),
        statusTotal: await tx.orderStatusHistory.count({where:{orderId:id}}),
        assignmentTotal: await tx.orderAssignmentHistory.count({where:{orderId:id}}),
        itemPage, itemTotal: row._count.items };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  list(query: OrdersQuery, actor: Account): Promise<OrderList> {
    const period = monthBounds(query.month);
    const from = query.fromDate ? new Date(query.fromDate + 'T00:00:00+07:00') : period.from;
    const until = query.toDate ? new Date(new Date(query.toDate + 'T00:00:00+07:00').getTime() + 86400000) : period.until;
    const canViewCost = actor.role === USER_ROLES.ADMIN;
    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: from, lt: until }, ...(query.status ? { status: query.status } : {}),
      ...(query.orderCode ? { orderCode: query.orderCode } : {}), ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
      ...(query.phoneNumber ? { items: { some: { phoneNumberSnapshot: query.phoneNumber } } } : {}),
    };
    return this.db.$transaction(async tx => {
      const total = await tx.order.count({ where });
      const rows = await tx.order.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        select: { id: true, orderCode: true, status: true, createdAt: true, assignedStaffId: true, claimedAt: true,
          customer: { select: { fullName: true } }, _count: { select: { items: true } },
          // One preview per order bounds list expansion; itemCount explicitly preserves remaining coverage.
          items: { take: 1, orderBy: { id: 'asc' }, select: { phoneNumberSnapshot: true, sellingPriceSnapshot: true, ...(canViewCost ? { costPriceSnapshot: true } : {}) } },
        } });
      const staffIds = [...new Set(rows.flatMap(row => row.assignedStaffId ? [row.assignedStaffId] : []))];
      const staff = await tx.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, fullName: true } });
      return { items: rows.map(row => ({ id: row.id, orderCode: row.orderCode, status: row.status, createdAt: row.createdAt.toISOString(),
        customerName: row.customer.fullName, assignedStaff: row.assignedStaffId ? { id: row.assignedStaffId, fullName: staff.find(user => user.id === row.assignedStaffId)?.fullName ?? null } : null,
        claimedAt: row.claimedAt?.toISOString() ?? null, isLocked: row.assignedStaffId !== null, itemCount: row._count.items,
        firstItem: row.items[0] ? { phoneNumber: row.items[0].phoneNumberSnapshot, sellingPrice: row.items[0].sellingPriceSnapshot.toString(),
          ...(canViewCost ? { costPrice: row.items[0].costPriceSnapshot?.toString() } : {}) } : null,
      })), total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize), canViewCost,
        month: query.month, fromDate: query.fromDate ?? null, toDate: query.toDate ?? null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
