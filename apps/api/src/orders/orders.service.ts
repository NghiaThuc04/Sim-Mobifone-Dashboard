import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Account, PERMISSIONS } from '@sim-dashboard/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { ordersQuery, orderId, detailQuery, claimInput, statusInput, assignInput } from './orders.input';
import type { SessionPrincipal } from '../auth/session.service';
import { OrderWorkflowRepository } from './order-workflow.repository';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(private readonly authorization: AuthorizationService, private readonly repository: OrdersRepository, private readonly workflow: OrderWorkflowRepository) {}
  assign(id: string, input: unknown, principal: SessionPrincipal) {
    this.authorization.assertAllowed(principal.user,PERMISSIONS.SETTINGS_ADMIN);
    const target = orderId.safeParse(id); const parsed = assignInput.safeParse(input);
    if (!target.success || !parsed.success) throw new BadRequestException('Invalid order id, assignee or reason.');
    return this.workflow.assign(target.data,parsed.data,principal);
  }
  status(id: string, input: unknown, principal: SessionPrincipal) {
    const target = orderId.safeParse(id); if (!target.success) throw new BadRequestException('Invalid order id.');
    const parsed = statusInput.safeParse(input); if (!parsed.success) throw new ConflictException('Trạng thái không hợp lệ.');
    return this.workflow.status(target.data,parsed.data.status,principal);
  }
  claim(id: string, input: unknown, principal: SessionPrincipal) {
    const parsed = orderId.safeParse(id);
    if (!parsed.success || !claimInput.safeParse(input).success) throw new BadRequestException('Invalid order id or claim body.');
    return this.workflow.claim(parsed.data, principal);
  }
  detail(id: string, input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.ORDERS_VIEW);
    const parsed = detailQuery.safeParse(input); const target = orderId.safeParse(id);
    if (!parsed.success || !target.success) throw new BadRequestException('Invalid order id or pagination.');
    return this.repository.detail(target.data, parsed.data.itemPage, actor);
  }
  list(input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.ORDERS_VIEW);
    const parsed = ordersQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid order filters, date range or pagination.');
    return this.repository.list(parsed.data, actor);
  }
}
