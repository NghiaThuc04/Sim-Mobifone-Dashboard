import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Account, PERMISSIONS } from '@sim-dashboard/shared';
import { APP_CONFIG, type ApiConfig } from '../config';
import { AuthorizationService } from '../authorization/authorization.service';
import { internalOrderInput } from './orders.input';
import { OrderCreateRepository } from './order-create.repository';

@Injectable()
export class OrderCreateService {
  constructor(@Inject(APP_CONFIG) private readonly config: ApiConfig, private readonly authorization: AuthorizationService,
    private readonly repository: OrderCreateRepository) {}
  create(input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.SETTINGS_ADMIN);
    if (!this.config.INTERNAL_ORDER_CREATION_ENABLED) throw new NotFoundException('Internal order creation is disabled.');
    const parsed = internalOrderInput.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Supply a UUID idempotencyKey, SIM id, customer fullName and phone; no prices or status input.');
    return this.repository.create(parsed.data, actor.id);
  }
}
