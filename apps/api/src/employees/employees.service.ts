import { BadRequestException, Injectable } from '@nestjs/common';
import { Account, PERMISSIONS } from '@sim-dashboard/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { EmployeesRepository } from './employees.repository';
import { employeesQuerySchema } from './employees.query';
import { createEmployeeSchema, employeeIdSchema, employeeStatusSchema, resetEmployeePasswordSchema, employeePermissionsSchema } from './employees.input';
import { hashPassword } from '../users/password';

@Injectable()
export class EmployeesService {
  constructor(private readonly repository: EmployeesRepository, private readonly authorization: AuthorizationService) {}
  permissions(id: string, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    return this.repository.permissions(this.employeeId(id));
  }
  setPermissions(id: string, input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    const parsed = employeePermissionsSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid or incomplete STAFF permission matrix.');
    return this.repository.setPermissions(this.employeeId(id), parsed.data.permissions, actor.id);
  }
  findStaff(id: string, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    return this.repository.findStaff(this.employeeId(id));
  }
  async resetPassword(id: string, input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    const target = this.employeeId(id);
    const parsed = resetEmployeePasswordSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid new password.');
    return this.repository.resetPassword(target, await hashPassword(parsed.data.password), actor.id);
  }
  private employeeId(id: string) {
    const parsed = employeeIdSchema.safeParse(id);
    if (!parsed.success) throw new BadRequestException('Invalid employee id.');
    return parsed.data;
  }
  setStatus(id: string, input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    const parsed = employeeStatusSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid employee status.');
    return this.repository.setStatus(this.employeeId(id), parsed.data.status, actor.id);
  }
  async create(input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    const parsed = createEmployeeSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid employee identity or password.');
    const { password, ...identity } = parsed.data;
    return this.repository.create({ ...identity, passwordHash: await hashPassword(password) }, actor.id);
  }
  list(input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.EMPLOYEES_ADMIN);
    const parsed = employeesQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid employee filters or pagination.');
    return this.repository.list(parsed.data, actor.id);
  }
}
