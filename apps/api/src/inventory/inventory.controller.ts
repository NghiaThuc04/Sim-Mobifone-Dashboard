import { Body,Controller,Delete,Get,Header,Param,Patch,Post,Query,Req,UnauthorizedException,UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import { AuthenticatedRequest } from '../auth/session.service';
import { InventoryService } from './inventory.service';
import { MutationGuard } from '../authorization/mutation.guard';
@Controller('admin/sims')
export class InventoryController {
  constructor(private readonly inventory:InventoryService) {}
  @Delete(':id') @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  remove(@Param('id') id:string,@Body() body:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal)throw new UnauthorizedException('Authentication required.');
    return this.inventory.remove(id,body,request.principal.user);
  }
  @Get(':id') @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @Header('Cache-Control','no-store')
  details(@Param('id') id:string,@Query() query:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal)throw new UnauthorizedException('Authentication required.');return this.inventory.details(id,query,request.principal.user);
  }
  @Patch(':id') @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  update(@Param('id') id:string,@Body() body:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal)throw new UnauthorizedException('Authentication required.');return this.inventory.update(id,body,request.principal.user);
  }
  @Post() @RequirePermission(PERMISSIONS.SETTINGS_ADMIN) @UseGuards(MutationGuard) @Header('Cache-Control','no-store')
  create(@Body() body:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal)throw new UnauthorizedException('Authentication required.');
    return this.inventory.create(body,request.principal.user);
  }
  @Get() @RequirePermission(PERMISSIONS.SIMS_VIEW) @Header('Cache-Control','no-store')
  list(@Query() query:unknown,@Req() request:AuthenticatedRequest) {
    if(!request.principal)throw new UnauthorizedException('Authentication required.');
    return this.inventory.list(query,request.principal.user);
  }
}
