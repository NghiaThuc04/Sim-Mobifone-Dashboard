import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { Account,PERMISSIONS } from '@sim-dashboard/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { catalogKind,catalogInput,catalogQuery } from './catalogs.input';
import { CatalogsRepository } from './catalogs.repository';
@Injectable()
export class CatalogsService {
  constructor(private readonly repository:CatalogsRepository,private readonly authorization:AuthorizationService) {}
  private kind(value:string) { const parsed=catalogKind.safeParse(value); if(!parsed.success) throw new NotFoundException('Unknown catalog.'); return parsed.data; }
  list(kind:string,input:unknown,actor:Account) {
    this.authorization.assertAllowed(actor,PERMISSIONS.SIMS_VIEW); const parsed=catalogQuery.safeParse(input);
    if(!parsed.success) throw new BadRequestException('Invalid catalog query.');
    return this.repository.list(this.kind(kind),parsed.data);
  }
  mutate(kind:string,id:string | undefined,input:unknown,remove:boolean,actor:Account) {
    this.authorization.assertAllowed(actor,PERMISSIONS.SETTINGS_ADMIN);
    if(id && !z.uuid().safeParse(id).success) throw new BadRequestException('Invalid catalog id.');
    if(remove) { if(!z.object({}).strict().safeParse(input).success) throw new BadRequestException('Deletion body must be an empty object.'); return this.repository.mutate(this.kind(kind),id,undefined,actor.id); }
    const parsed=catalogInput.safeParse(input); if(!parsed.success) throw new BadRequestException('Invalid catalog code/name.');
    return this.repository.mutate(this.kind(kind),id,parsed.data,actor.id);
  }
}
