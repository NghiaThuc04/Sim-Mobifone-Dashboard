import { Controller, Header, NotImplementedException, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS, STAFF_SIM_UPLOAD_PENDING, type StaffSimUploadUnavailable } from '@sim-dashboard/shared';
import { RequirePermission } from '../authorization/access.decorators';
import { MutationGuard } from '../authorization/mutation.guard';

@Controller('admin/staff-sim-submissions')
export class StaffSimSubmissionsController {
  @Post() @RequirePermission(PERMISSIONS.SIMS_CREATE) @UseGuards(MutationGuard) @Header('Cache-Control', 'no-store')
  submit(): never {
    const result: StaffSimUploadUnavailable = { code: 'STAFF_SIM_UPLOAD_NOT_IMPLEMENTED', status: 'NOT_IMPLEMENTED',
      message: 'Chức năng đăng SIM: cần cấu hình quy trình', pendingDecisions: STAFF_SIM_UPLOAD_PENDING };
    throw new NotImplementedException(result);
  }
}
