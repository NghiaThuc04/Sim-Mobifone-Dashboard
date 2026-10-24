import { Injectable,NotFoundException } from '@nestjs/common';
import { Account,hasPermission,PERMISSIONS,USER_ROLES } from '@sim-dashboard/shared';
import { DatabaseService } from '../database/database.service';
import { Prisma, type Sim, type Carrier, type SimCategory } from '../generated/prisma/client';
import { calculateGrossProfit } from './sim-pricing';
import type { InventoryQuery } from './inventory.input';
import { simSnapshotSchema } from './inventory.input';

export function simDto(sim:Sim & {carrier:Carrier;category:SimCategory},actor:Account) {
  const catalog=(item:Carrier)=>({id:item.id,code:item.code,name:item.name});
  return {id:sim.id,phoneNumber:sim.phoneNumber,carrier:catalog(sim.carrier),category:catalog(sim.category),sellingPrice:sim.sellingPrice.toString(),
    ...(actor.role===USER_ROLES.ADMIN?{costPrice:sim.costPrice.toString()}:{}),
    ...(hasPermission(actor,PERMISSIONS.PROFITS_VIEW)?{grossProfit:calculateGrossProfit(sim.costPrice.toString(),sim.sellingPrice.toString())}:{}),
    stockStatus:sim.stockStatus,isVisible:sim.isVisible,visibilityRequested:sim.visibilityRequested,hasPriceError:sim.hasPriceError,
    version:sim.version,createdAt:sim.createdAt.toISOString(),updatedAt:sim.updatedAt.toISOString()};
}
@Injectable()
export class InventoryRepository {
  constructor(private readonly db:DatabaseService) {}
  details(id:string,page:number,pageSize:number,actor:Account) {
    return this.db.$transaction(async tx=>{
      const sim=await tx.sim.findFirst({where:{id,deletedAt:null},include:{carrier:true,category:true}});if(!sim)throw new NotFoundException('SIM not found.');
      const total=await tx.simChange.count({where:{simId:id}});
      const history=await tx.simChange.findMany({where:{simId:id},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
      return {item:simDto(sim,actor),history:history.map(change=>({id:change.id,actorId:change.actorId,before:simSnapshotSchema.parse(change.before),after:simSnapshotSchema.parse(change.after),createdAt:change.createdAt.toISOString()})),total,page,totalPages:Math.ceil(total/pageSize)};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  list(query:InventoryQuery,actor:Account) {
    const where:Prisma.SimWhereInput={deletedAt:null,
      ...(query.search?{phoneNumber:{contains:query.search}}:{}),...(query.carrierId?{carrierId:query.carrierId}:{}),...(query.categoryId?{categoryId:query.categoryId}:{}),
      ...(query.status?{stockStatus:query.status}:{}),...(query.visibility?{isVisible:query.visibility==='visible'}:{}),...(query.priceError?{hasPriceError:query.priceError==='true'}:{}),
      ...((query.minPrice||query.maxPrice)?{sellingPrice:{...(query.minPrice?{gte:query.minPrice}:{}),...(query.maxPrice?{lte:query.maxPrice}:{})}}:{})};
    return this.db.$transaction(async tx=>{
      const total=await tx.sim.count({where});
      const rows=await tx.sim.findMany({where,include:{carrier:true,category:true},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(query.page-1)*query.pageSize,take:query.pageSize});
      return {items:rows.map(row=>simDto(row,actor)),total,page:query.page,pageSize:query.pageSize,totalPages:Math.ceil(total/query.pageSize),
        canViewCost:actor.role===USER_ROLES.ADMIN,canViewProfit:hasPermission(actor,PERMISSIONS.PROFITS_VIEW)};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
