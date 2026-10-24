import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CatalogKind } from '@sim-dashboard/shared';
import { Prisma } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import type { CatalogInput, CatalogQuery } from './catalogs.input';
import { z } from 'zod';

type CatalogRow = { id:string; code:string; name:string; createdAt:Date; updatedAt:Date };
const columns = Prisma.sql`id,code,name,created_at AS "createdAt",updated_at AS "updatedAt"`;
const table = (kind:CatalogKind) => kind === 'carriers' ? Prisma.sql`carriers` : Prisma.sql`sim_categories`;
const dto = (item:CatalogRow) => ({ ...item, createdAt:item.createdAt.toISOString(), updatedAt:item.updatedAt.toISOString() });
const driverFailure = z.object({ driverAdapterError:z.object({ cause:z.object({ kind:z.enum(['UniqueConstraintViolation','ForeignKeyConstraintViolation','RestrictViolation']) }) }) });

@Injectable()
export class CatalogsRepository {
  constructor(private readonly db:DatabaseService, private readonly audit:AuditService) {}
  list(kind:CatalogKind, query:CatalogQuery) {
    const pattern = '%' + (query.search ?? '').replace(/[\\%_]/g,'\\$&') + '%';
    const where = query.search ? Prisma.sql`WHERE name COLLATE "pg_unicode_fast" ILIKE ${pattern} OR code ILIKE ${pattern}` : Prisma.empty;
    return this.db.$transaction(async (tx) => {
      const [{ total }] = await tx.$queryRaw<{total:number}[]>`SELECT count(*)::int AS total FROM ${table(kind)} ${where}`;
      const rows = await tx.$queryRaw<CatalogRow[]>`SELECT ${columns} FROM ${table(kind)} ${where} ORDER BY code,id LIMIT ${query.pageSize} OFFSET ${(query.page-1)*query.pageSize}`;
      return {items:rows.map(dto),total,page:query.page,pageSize:query.pageSize,totalPages:Math.ceil(total/query.pageSize)};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  async mutate(kind:CatalogKind, id:string | undefined, input:CatalogInput | undefined, actorId:string) {
    try {
      return await this.db.$transaction(async (tx) => {
        const previous = id ? (await tx.$queryRaw<CatalogRow[]>`SELECT ${columns} FROM ${table(kind)} WHERE id=${id}::uuid FOR UPDATE`)[0] : undefined;
        if (id && !previous) throw new NotFoundException('Catalog item not found.');
        let row:CatalogRow;
        if (!id && input) [row] = await tx.$queryRaw<CatalogRow[]>`INSERT INTO ${table(kind)}(id,code,name) VALUES(${randomUUID()}::uuid,${input.code},${input.name}) RETURNING ${columns}`;
        else if (id && input) [row] = await tx.$queryRaw<CatalogRow[]>`UPDATE ${table(kind)} SET code=${input.code},name=${input.name},updated_at=CURRENT_TIMESTAMP WHERE id=${id}::uuid RETURNING ${columns}`;
        else {
          if (!id || !previous) throw new NotFoundException('Catalog item not found.');
          await tx.$executeRaw`DELETE FROM ${table(kind)} WHERE id=${id}::uuid`; row=previous;
        }
        await this.audit.append({actorKind:'USER',actorId,action:!id ? AUDIT_ACTIONS.CATALOG_CREATED : input ? AUDIT_ACTIONS.CATALOG_UPDATED : AUDIT_ACTIONS.CATALOG_DELETED,
          targetType:'CATALOG',targetId:row.id,metadata:{catalogKind:kind,
            ...(previous ? {previousCatalog:{code:previous.code,name:previous.name}} : {}), ...(input ? {catalog:input} : {})}},tx);
        return dto(row);
      });
    } catch(error) {
      if(error instanceof Prisma.PrismaClientKnownRequestError) {
        const parsed = error.code === 'P2010' ? driverFailure.safeParse(error.meta) : undefined;
        if(parsed?.success && parsed.data.driverAdapterError.cause.kind==='UniqueConstraintViolation') throw new ConflictException('Catalog code already exists.');
        if(parsed?.success && ['ForeignKeyConstraintViolation','RestrictViolation'].includes(parsed.data.driverAdapterError.cause.kind)) throw new ConflictException('Catalog item is referenced by SIM inventory.');
      }
      throw error;
    }
  }
}
