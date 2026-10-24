BEGIN;
CREATE TABLE employee_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL,
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY (user_id, permission),
  CONSTRAINT employee_permission_allowlist CHECK (permission IN (
    'orders.view', 'orders.claim', 'orders.update.own', 'sims.view', 'sims.create', 'sims.delete.eligible',
    'articles.create', 'articles.publish', 'profits.view', 'check-sim.view', 'payroll.view.self', 'leaves.view.self'
  ))
);
-- updated_by retains actor identity, like audit_logs; account deletion must not rewrite history.
COMMIT;
