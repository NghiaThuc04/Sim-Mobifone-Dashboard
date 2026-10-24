import { BadRequestException,ConflictException,Injectable } from '@nestjs/common';
import { Account,PERMISSIONS } from '@sim-dashboard/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { InventoryRepository,simDto } from './inventory.repository';
import { inventoryQuery,simInput,simPatch,simHistoryQuery,simRemovalInput } from './inventory.input';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { SimWriteRepository } from './sim-write.repository';
@Injectable()
export class InventoryService {
  constructor(private readonly repository:InventoryRepository,private readonly authorization:AuthorizationService,private readonly db:DatabaseService,private readonly writer:SimWriteRepository) {}
  private adminTarget(id:string,actor:Account) {this.authorization.assertAllowed(actor,PERMISSIONS.SETTINGS_ADMIN);if(!z.uuid().safeParse(id).success)throw new BadRequestException('Invalid SIM id.');return id;}
  remove(id: string, input: unknown, actor: Account) {
    const target = this.adminTarget(id, actor);
    const parsed = simRemovalInput.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Supply a current version and an optional reason of 1–500 characters.');
    return this.db.$transaction(tx => this.writer.remove(tx, target, parsed.data, actor.id));
  }
  details(id:string,query:unknown,actor:Account) {
    const target=this.adminTarget(id,actor);const parsed=simHistoryQuery.safeParse(query);if(!parsed.success)throw new BadRequestException('Invalid history pagination.');
    return this.repository.details(target,parsed.data.page,parsed.data.pageSize,actor);
  }
  async update(id:string,input:unknown,actor:Account) {
    const target=this.adminTarget(id,actor);const parsed=simPatch.safeParse(input);if(!parsed.success)throw new BadRequestException({message:'Invalid SIM patch.',fields:Object.fromEntries(parsed.error.issues.map(issue=>[String(issue.path[0]??'form'),'Giá trị không hợp lệ hoặc thiếu.']))});
    try{return simDto(await this.db.$transaction(tx=>this.writer.update(tx,target,parsed.data,actor.id)),actor);}
    catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException({message:'Active phone already exists.',fields:{phoneNumber:'Số SIM đã tồn tại.'}});throw error;}
  }
  async create(input:unknown,actor:Account) {
    this.authorization.assertAllowed(actor,PERMISSIONS.SETTINGS_ADMIN);const parsed=simInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException({message:'Invalid SIM input.',fields:Object.fromEntries(parsed.error.issues.map(issue=>[String(issue.path[0]??'form'),'Giá trị không hợp lệ hoặc thiếu.']))});
    const sim=await this.db.$transaction(tx=>this.writer.create(tx,parsed.data,actor.id));
    if(!sim)throw new ConflictException({message:'Active SIM already exists.',fields:{phoneNumber:'Số SIM đã tồn tại trong kho hoạt động.'}});
    return simDto(sim,actor);
  }
  list(input:unknown,actor:Account) {
    this.authorization.assertAllowed(actor,PERMISSIONS.SIMS_VIEW);const parsed=inventoryQuery.safeParse(input);
    if(!parsed.success)throw new BadRequestException('Invalid inventory filters or pagination.');
    return this.repository.list(parsed.data,actor);
  }
}
