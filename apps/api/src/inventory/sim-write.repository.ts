import { BadRequestException,ConflictException,Injectable,NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma,type Sim } from '../generated/prisma/client';
import { AuditService,AUDIT_ACTIONS } from '../audit/audit.service';
import { SimPricingService } from './sim-pricing.service';
import type { SimInput,simPatch,simRemovalInput } from './inventory.input';
import type { z } from 'zod';
const snapshot=(sim:Sim)=>({phoneNumber:sim.phoneNumber,carrierId:sim.carrierId,categoryId:sim.categoryId,costPrice:sim.costPrice.toString(),sellingPrice:sim.sellingPrice.toString(),stockStatus:sim.stockStatus,visibilityRequested:sim.visibilityRequested,isVisible:sim.isVisible,hasPriceError:sim.hasPriceError,version:sim.version});

@Injectable()
export class SimWriteRepository {
 constructor(private readonly pricing:SimPricingService,private readonly audit:AuditService) {}
 async remove(tx: Prisma.TransactionClient, id: string, input: z.infer<typeof simRemovalInput>, actorId: string) {
  await tx.$queryRaw`SELECT id FROM sims WHERE id=${id}::uuid FOR UPDATE`;
  const previous = await tx.sim.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new NotFoundException('SIM not found in active inventory.');
  if (previous.version !== input.version) throw new ConflictException('SIM changed. Reload before removing.');
  const before = snapshot(previous);
  const removedAt = new Date();
  const current = await tx.sim.update({ where: { id, version: input.version }, data: {
   deletedAt: removedAt, isVisible: false, visibilityRequested: false, updatedBy: actorId, version: { increment: 1 },
  } });
  const log = await tx.simRemovalLog.create({ data: {
   simId: id, phoneNumberSnapshot: previous.phoneNumber, actorId, reason: input.reason ?? null, before, removedAt,
  } });
  await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.SIM_REMOVED,
   targetType: 'SIM', targetId: id, metadata: { simBefore: before, removalId: log.id, removedAt: removedAt.toISOString() } }, tx);
  return { id, deletedAt: removedAt.toISOString(), version: current.version };
 }
 async requireCatalogs(tx:Prisma.TransactionClient,input:Pick<SimInput,'carrierId'|'categoryId'>) {
  const carrier=await tx.$queryRaw<{id:string}[]>`SELECT id FROM carriers WHERE id=${input.carrierId}::uuid FOR KEY SHARE`;
  const category=await tx.$queryRaw<{id:string}[]>`SELECT id FROM sim_categories WHERE id=${input.categoryId}::uuid FOR KEY SHARE`;
  if(!carrier.length||!category.length)throw new BadRequestException({message:'Invalid SIM catalog.',fields:{...(!carrier.length?{carrierId:'Nhà mạng không tồn tại.'}:{}),...(!category.length?{categoryId:'Danh mục không tồn tại.'}:{})}});
 }
 async create(tx:Prisma.TransactionClient,input:SimInput,actorId:string) {
  // Shared by manual creation and import; database arbitrates active-phone uniqueness.
  await this.requireCatalogs(tx,input);
  const rows=await tx.$queryRaw<{id:string}[]>`INSERT INTO sims(id,phone_number,carrier_id,category_id,cost_price,selling_price,stock_status,visibility_requested,created_by,updated_by)
   VALUES(${randomUUID()}::uuid,${input.phoneNumber},${input.carrierId}::uuid,${input.categoryId}::uuid,${input.costPrice}::numeric,${input.sellingPrice}::numeric,${input.stockStatus}::"SimStockStatus",${input.visibilityRequested},${actorId}::uuid,${actorId}::uuid)
   ON CONFLICT(phone_number) WHERE deleted_at IS NULL DO NOTHING RETURNING id`;
  if(!rows.length)return null;
  const sim=await this.pricing.reconcile(tx,rows[0].id,actorId);
  await this.audit.append({actorKind:'USER',actorId,action:AUDIT_ACTIONS.SIM_CREATED,targetType:'SIM',targetId:sim.id,metadata:{source:'api',priceError:sim.hasPriceError}},tx);
  return tx.sim.findUniqueOrThrow({where:{id:sim.id},include:{carrier:true,category:true}});
 }
 async update(tx:Prisma.TransactionClient,id:string,input:z.infer<typeof simPatch>,actorId:string) {
  await tx.$queryRaw`SELECT id FROM sims WHERE id=${id}::uuid FOR UPDATE`;
  const previous=await tx.sim.findFirst({where:{id,deletedAt:null}});if(!previous)throw new NotFoundException('SIM not found.');
  if(previous.version!==input.version)throw new ConflictException('SIM changed. Reload before editing.');
  const {version,...fields}=input;
  await this.requireCatalogs(tx,{carrierId:fields.carrierId??previous.carrierId,categoryId:fields.categoryId??previous.categoryId});
  await tx.sim.update({where:{id,version},data:{...fields,isVisible:false,updatedBy:actorId,version:{increment:1}}});
  const current=await this.pricing.reconcile(tx,id,actorId);
  const before=snapshot(previous);const after=snapshot(current);
  await tx.simChange.create({data:{simId:id,actorId,before,after}});
  await this.audit.append({actorKind:'USER',actorId,action:AUDIT_ACTIONS.SIM_UPDATED,targetType:'SIM',targetId:id,metadata:{simBefore:before,simAfter:after}},tx);
  return tx.sim.findUniqueOrThrow({where:{id},include:{carrier:true,category:true}});
 }
}
