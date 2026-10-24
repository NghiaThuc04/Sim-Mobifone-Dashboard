import { BadRequestException, Injectable } from '@nestjs/common';
import { type Account, PERMISSIONS } from '@sim-dashboard/shared';
import { z } from 'zod';
import { AuthorizationService } from '../authorization/authorization.service';
import { CheckSimRepository } from './check-sim.repository';

const lookupQuery = z.object({ phoneNumber: z.string().trim().regex(/^\d{1,32}$/) }).strict();
@Injectable()
export class CheckSimService {
  constructor(private readonly repository: CheckSimRepository, private readonly authorization: AuthorizationService) {}
  lookup(input: unknown, actor: Account) {
    this.authorization.assertAllowed(actor, PERMISSIONS.CHECK_SIM_VIEW);
    const parsed = lookupQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Supply an exact phone number of 1–32 digits.');
    return this.repository.findActive(parsed.data.phoneNumber, actor);
  }
}
