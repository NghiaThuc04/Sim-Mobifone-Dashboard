import { type Account, hasPermission, PERMISSIONS, type SimRemovalEligibility, USER_ROLES } from '@sim-dashboard/shared';

// No order-completion source or authorized error-confirmation workflow exists yet.
// Neither SOLD, price alerts nor a legacy timestamp establish deletion eligibility.
export function removalEligibility(actor: Account): SimRemovalEligibility {
  if (actor.role === USER_ROLES.ADMIN) return { allowed: true, reason: 'ADMIN' };
  return { allowed: false, reason: hasPermission(actor, PERMISSIONS.SIMS_DELETE_ELIGIBLE) ? 'VERIFIED_SOURCE_MISSING' : 'PERMISSION_DENIED' };
}
