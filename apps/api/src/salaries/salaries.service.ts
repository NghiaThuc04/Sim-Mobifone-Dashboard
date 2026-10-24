import { BadRequestException, Injectable } from '@nestjs/common';
import { Account, PERMISSIONS } from '@sim-dashboard/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { employeeIdSchema } from '../employees/employees.input';
import { salaryInput, salaryQuery } from './salaries.input';
import { SalariesRepository } from './salaries.repository';

@Injectable()
export class SalariesService {
  constructor(private readonly repository: SalariesRepository, private readonly authorization: AuthorizationService) {}
  private target(id: string, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    if (!employeeIdSchema.safeParse(id).success) throw new BadRequestException('Invalid employee id.');
    return id;
  }
  history(id: string, input: unknown, actor: Account) {
    const target = this.target(id, actor); const parsed = salaryQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid salary month or pagination.');
    return this.repository.history(target, parsed.data.month, parsed.data.page, parsed.data.pageSize);
  }
  create(id: string, input: unknown, actor: Account) {
    const target = this.target(id, actor); const parsed = salaryInput.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid exact salary amount or effective time.');
    return this.repository.create(target, parsed.data.amount, parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : undefined, actor.id);
  }
}
