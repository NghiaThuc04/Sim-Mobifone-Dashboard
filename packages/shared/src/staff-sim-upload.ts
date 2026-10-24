export const STAFF_SIM_UPLOAD_PENDING = ['NUMBER_SOURCE', 'INPUT_FORMAT', 'PRICE_AUTHORITY', 'APPROVAL_WORKFLOW', 'DUPLICATE_POLICY'] as const;
export type StaffSimUploadUnavailable = {
  code: 'STAFF_SIM_UPLOAD_NOT_IMPLEMENTED';
  status: 'NOT_IMPLEMENTED';
  message: string;
  pendingDecisions: readonly typeof STAFF_SIM_UPLOAD_PENDING[number][];
};
