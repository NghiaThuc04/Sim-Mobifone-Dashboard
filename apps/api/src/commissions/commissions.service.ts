import { BadRequestException, Injectable } from '@nestjs/common';
import { Account, PERMISSIONS } from '@sim-dashboard/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { employeeIdSchema } from '../employees/employees.input';
import { commissionHistoryQuery, commissionPolicySchema } from './commissions.input';
import { CommissionsRepository } from './commissions.repository';

@Injectable()
export class CommissionsService {
  constructor(private readonly repository: CommissionsRepository, private readonly authorization: AuthorizationService) {}
  private target(id: string, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    if (!employeeIdSchema.safeParse(id).success) throw new BadRequestException('Invalid employee id.');
    return id;
  }
  history(id: string, input: unknown, actor: Account) {
    const target = this.target(id, actor);
    const parsed = commissionHistoryQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid commission history pagination.');
    return this.repository.history(target, parsed.data.page, parsed.data.pageSize);
  }
  create(id: string, input: unknown, actor: Account) {
    const target = this.target(id, actor);
    const parsed = commissionPolicySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid decimal percentage or effective time.');
    return this.repository.create(target, parsed.data.ratePercent, parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : undefined, actor.id);
  }
}
