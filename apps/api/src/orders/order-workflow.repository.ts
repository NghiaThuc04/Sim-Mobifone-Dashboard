import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { effectivePermissions, ORDER_NEXT_STATUS, PERMISSIONS, type OrderStatus, type Account, type Permission } from '@sim-dashboard/shared';
import { DatabaseService } from '../database/database.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { CommissionsRepository } from '../commissions/commissions.repository';
import { type Order } from '../generated/prisma/client';
import { type Prisma } from '../generated/prisma/client';
import { type SessionPrincipal } from '../auth/session.service';

@Injectable()
export class OrderWorkflowRepository {
 constructor(private readonly db: DatabaseService, private readonly audit: AuditService, private readonly authorization: AuthorizationService, private readonly commissions: CommissionsRepository) {}
 private async lockOrder(tx: Prisma.TransactionClient, id: string) {
   await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
   const order = await tx.order.findUnique({where:{id}});
   if (!order) throw new NotFoundException('Order not found.');
   return order;
 }
 // Re-read identity and permissions after the order lock; requests waiting behind a transfer or revocation use current authority.
 private async currentActor(tx: Prisma.TransactionClient, principal: SessionPrincipal, permission: Permission, ownerId?: string | null): Promise<Account> {
   await tx.$queryRaw`SELECT id FROM users WHERE id = ${principal.user.id}::uuid FOR SHARE`;
   const session = await tx.authSession.findFirst({where:{id:principal.id,userId:principal.user.id,expiresAt:{gt:new Date()},user:{status:'active'}},
     select:{user:{select:{id:true,email:true,fullName:true,role:true,permissions:{select:{permission:true,enabled:true}}}}}});
   if (!session) throw new UnauthorizedException('Authentication required.');
   const user = session.user; const actor = {...user,permissions:effectivePermissions(user.role,user.permissions)};
   this.authorization.assertAllowed(actor,permission,{ownerId:ownerId ?? undefined}); return actor;
 }
 assign(id: string, input: {assignedStaffId:string|null;reason?:string}, principal: SessionPrincipal) {
   return this.db.$transaction(async tx => {
     const order = await this.lockOrder(tx,id);
     const actor = await this.currentActor(tx,principal,PERMISSIONS.SETTINGS_ADMIN);
     if (input.assignedStaffId) {
       await tx.$queryRaw`SELECT id FROM users WHERE id = ${input.assignedStaffId}::uuid FOR SHARE`;
       const staff = await tx.user.findUnique({where:{id:input.assignedStaffId},select:{role:true,status:true}});
       if (!staff || staff.role !== 'STAFF' || staff.status !== 'active') throw new BadRequestException('Người nhận phải là STAFF đang hoạt động.');
     }
     if (order.assignedStaffId === input.assignedStaffId) return {id,assignedStaffId:order.assignedStaffId,beneficiaryNeedsDecision:order.beneficiaryNeedsDecision};
     const at = (await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS now`)[0].now;
     const beneficiaryNeedsDecision = order.beneficiaryNeedsDecision || order.assignedStaffId !== null;
     await tx.order.update({where:{id},data:{assignedStaffId:input.assignedStaffId,claimedAt:input.assignedStaffId?at:null,beneficiaryNeedsDecision}});
     const history = await tx.orderAssignmentHistory.create({data:{orderId:id,previousStaffId:order.assignedStaffId,assignedStaffId:input.assignedStaffId,actorId:actor.id,action:'ASSIGN',reason:input.reason || null,createdAt:at}});
     await this.audit.append({actorKind:'USER',actorId:actor.id,action:AUDIT_ACTIONS.ORDER_ASSIGNED,targetType:'ORDER',targetId:id,
       metadata:{source:'api',assignmentId:history.id,previousStaffId:order.assignedStaffId,assignedStaffId:input.assignedStaffId,beneficiaryNeedsDecision}},tx);
     return {id,assignedStaffId:input.assignedStaffId,beneficiaryNeedsDecision};
   },{maxWait:10000,timeout:10000});
 }
 private async complete(tx: Prisma.TransactionClient, order: Order, actor: Account) {
   if (!await tx.orderItem.count({where:{orderId:order.id}})) throw new ConflictException('Đơn chưa có chi tiết SIM.');
   // Serialize the completion instant against P15 policy writers, which lock this same user row.
   if (order.assignedStaffId) await tx.$queryRaw`SELECT id FROM users WHERE id = ${order.assignedStaffId}::uuid FOR SHARE`;
   const handler = order.assignedStaffId ? await tx.user.findUnique({where:{id:order.assignedStaffId},select:{id:true,role:true}}) : null;
   const rateEmployeeId = handler?.role === 'STAFF' ? handler.id : null;
   const at = (await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS now`)[0].now;
   const policy = rateEmployeeId ? await this.commissions.lookupAt(rateEmployeeId,at,tx) : null;
   const beneficiaryId = !order.beneficiaryNeedsDecision ? rateEmployeeId : null;
   const beneficiaryState = beneficiaryId ? 'RESOLVED' : 'UNRESOLVED';
   await tx.order.update({where:{id:order.id},data:{status:'COMPLETED',completedAt:at,completedBy:actor.id,beneficiaryNeedsDecision:!beneficiaryId || order.beneficiaryNeedsDecision}});
   await tx.orderCompletion.create({data:{orderId:order.id,completedAt:at,completedBy:actor.id,rateEmployeeId,
     ratePolicyId:policy?.id ?? null,rateSnapshot:policy?.ratePercent ?? null,policyEffectiveAt:policy?new Date(policy.effectiveAt):null,beneficiaryId,beneficiaryState}});
   await this.audit.append({actorKind:'USER',actorId:actor.id,action:AUDIT_ACTIONS.ORDER_COMPLETED,targetType:'ORDER',targetId:order.id,
     metadata:{source:'api',completedAt:at.toISOString(),rateEmployeeId,ratePolicyId:policy?.id ?? null,rateSnapshot:policy?.ratePercent ?? null,beneficiaryState}},tx);
   return at;
 }
 status(id: string, status: OrderStatus, principal: SessionPrincipal) {
   return this.db.$transaction(async tx => {
     const order = await this.lockOrder(tx,id);
     const actor = await this.currentActor(tx,principal,PERMISSIONS.ORDERS_UPDATE_OWN,order.assignedStaffId);
     if (ORDER_NEXT_STATUS[order.status] !== status) throw new ConflictException('Chuyển trạng thái không hợp lệ.');
     const at = status === 'COMPLETED' ? await this.complete(tx,order,actor) : (await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS now`)[0].now;
     if (status !== 'COMPLETED') await tx.order.update({where:{id},data:{status}});
     const history = await tx.orderStatusHistory.create({data:{orderId:id,actorId:actor.id,previousStatus:order.status,status,createdAt:at}});
     await this.audit.append({actorKind:'USER',actorId:actor.id,action:AUDIT_ACTIONS.ORDER_STATUS_CHANGED,targetType:'ORDER',targetId:id,
       metadata:{source:'api',statusHistoryId:history.id,orderPreviousStatus:order.status,orderStatus:status}},tx);
     return {id,status};
   },{maxWait:10000,timeout:10000});
 }
 claim(id: string, principal: SessionPrincipal) {
   return this.db.$transaction(async tx => {
     const order = await this.lockOrder(tx,id);
     const actor = await this.currentActor(tx,principal,PERMISSIONS.ORDERS_CLAIM);
     if (['COMPLETED','CANCELLED'].includes(order.status)) throw new ConflictException('Đơn đã kết thúc.');
     if (order.assignedStaffId) {
       if (order.assignedStaffId === actor.id) return {id:order.id,status:order.status,assignedStaffId:actor.id,claimedAt:order.claimedAt?.toISOString() ?? null};
       throw new ConflictException('đơn đã có người nhận');
     }
     const at = (await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS now`)[0].now;
     await tx.order.update({where:{id},data:{assignedStaffId:actor.id,claimedAt:at}});
     const history = await tx.orderAssignmentHistory.create({data:{orderId:id,assignedStaffId:actor.id,actorId:actor.id,action:'CLAIM',createdAt:at}});
     await this.audit.append({actorKind:'USER',actorId:actor.id,action:AUDIT_ACTIONS.ORDER_CLAIMED,targetType:'ORDER',targetId:id,metadata:{source:'api',assignmentId:history.id}},tx);
     return {id,status:order.status,assignedStaffId:actor.id,claimedAt:at.toISOString()};
   },{maxWait:10000,timeout:10000});
 }
}
