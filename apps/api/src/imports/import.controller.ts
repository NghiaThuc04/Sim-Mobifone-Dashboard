import { Body,Controller,Header,Param,Post,Req,UnauthorizedException,UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';
import { AuthenticatedRequest } from '../auth/session.service';
import { SimImportService } from './import.service';
@Controller('admin/sim-imports')
@RequirePermission(PERMISSIONS.SETTINGS_ADMIN)
@UseGuards(MutationGuard)
export class SimImportController {
 constructor(private readonly imports:SimImportService) {}
 @Post('preview') @Header('Cache-Control','no-store')
 preview(@Body() body:unknown,@Req() request:AuthenticatedRequest){if(!request.principal)throw new UnauthorizedException('Authentication required.');return this.imports.preview(body,request.principal.user);}
 @Post(':id/confirm') @Header('Cache-Control','no-store')
 confirm(@Param('id') id:string,@Body() body:unknown,@Req() request:AuthenticatedRequest){if(!request.principal)throw new UnauthorizedException('Authentication required.');return this.imports.confirm(id,body,request.principal.user);}
}
