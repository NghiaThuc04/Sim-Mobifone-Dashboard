import { Body,Controller,Delete,Get,Header,HttpCode,Param,Post,Put,Query,Req,UnauthorizedException,UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';
import { AuthenticatedRequest } from '../auth/session.service';
import { CatalogsService } from './catalogs.service';
@Controller('admin/catalogs')
export class CatalogsController {
  constructor(private readonly catalogs:CatalogsService) {}
  @Get(':kind') @RequirePermission(PERMISSIONS.SIMS_VIEW) @Header('Cache-Control','no-store')
  list(@Param('kind') kind:string,@Query() query:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.catalogs.list(kind,query,request.principal.user);
  }
  @Post(':kind') @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  create(@Param('kind') kind:string,@Body() body:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.catalogs.mutate(kind,undefined,body,false,request.principal.user);
  }
  @Put(':kind/:id') @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  update(@Param('kind') kind:string,@Param('id') id:string,@Body() body:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal) throw new UnauthorizedException('Authentication required.');
    return this.catalogs.mutate(kind,id,body,false,request.principal.user);
  }
  @Delete(':kind/:id') @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @HttpCode(204) @Header('Cache-Control','no-store')
  async remove(@Param('kind') kind:string,@Param('id') id:string,@Body() body:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal) throw new UnauthorizedException('Authentication required.');
    await this.catalogs.mutate(kind,id,body,true,request.principal.user);
  }
}
