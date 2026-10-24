export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export type InternalOrderCreateResult = { id: string; orderCode: string; status: 'PENDING' };
export type OrderListItem = {
  id: string; orderCode: string; status: OrderStatus; createdAt: string;
  customerName: string; assignedStaff: { id: string; fullName: string | null } | null;
  claimedAt: string | null; isLocked: boolean; itemCount: number;
  firstItem: { phoneNumber: string; sellingPrice: string; costPrice?: string } | null;
};
export type OrderList = {
  items: OrderListItem[]; total: number; page: number; pageSize: number; totalPages: number; canViewCost: boolean;
  month: string; fromDate: string | null; toDate: string | null;
};

export type OrderDetail = {
 id: string; orderCode: string; status: OrderStatus; createdAt: string;
 customer: { fullName: string; phone: string }; assignedStaff: { id: string; fullName: string | null } | null;
 beneficiaryNeedsDecision: boolean; claimedAt: string | null; completedAt: string | null; completedBy: string | null; canViewCost: boolean;
 items: { id: string; simId: string; phoneNumber: string; sellingPrice: string; costPrice?: string }[];
 assignmentHistory: { id: string; previousStaffId: string | null; assignedStaffId: string | null; actorId: string; action: string; reason: string | null; createdAt: string }[];
 statusHistory: { id: string; actorId: string; previousStatus: OrderStatus; status: OrderStatus; createdAt: string }[];
 completion: { completedAt: string; completedBy: string; approvalStatus: 'PENDING_APPROVAL'; rateEmployeeId: string | null; ratePolicyId: string | null; rateSnapshot: string | null; policyEffectiveAt: string | null; beneficiaryId: string | null; beneficiaryState: 'RESOLVED' | 'UNRESOLVED' } | null;
 statusTotal: number; assignmentTotal: number; itemPage: number; itemTotal: number;
};

// Provisional transitions explicitly permitted by Batch09 until the full workflow is decided.
export const ORDER_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { PENDING: 'CONFIRMED', CONFIRMED: 'PROCESSING', PROCESSING: 'COMPLETED' };
