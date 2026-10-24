import { BadRequestException, Injectable } from '@nestjs/common';
import { Account, PERMISSIONS } from '@sim-dashboard/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { employeeIdSchema } from '../employees/employees.input';
import { LeavesRepository } from './leaves.repository';
import { leaveInput, leaveQuery } from './leaves.input';
import { EmployeesRepository } from '../employees/employees.repository';

@Injectable()
export class LeavesService {
  constructor(private readonly repository: LeavesRepository, private readonly authorization: AuthorizationService, private readonly employees: EmployeesRepository) {}
  async mine(input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.LEAVES_VIEW_SELF, { ownerId: actor.id });
    const parsed = leaveQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid personal leave month or pagination.');
    const result = await this.repository.list(actor.id, parsed.data.month, parsed.data.page, parsed.data.pageSize);
    return { month: result.month, totalDays: result.totalDays, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages,
      items: result.items.map(({ id, fromDate, toDate, days, daysInMonth, reason, notes }) => ({ id, fromDate, toDate, days, daysInMonth, reason, notes })) };
  }
  private target(id: string, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    if (!employeeIdSchema.safeParse(id).success) throw new BadRequestException('Invalid employee id.');
    return id;
  }
  create(id: string, input: unknown, actor: Account) {
    const target = this.target(id, actor); const parsed = leaveInput.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid leave period or confirmed allocations.');
    return this.repository.create(target, parsed.data, actor.id);
  }
  async list(id: string, input: unknown, actor: Account) {
    const target = this.target(id, actor); const parsed = leaveQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid leave month or pagination.');
    await this.employees.requireStaff(target);
    return this.repository.list(target, parsed.data.month, parsed.data.page, parsed.data.pageSize);
  }
}
