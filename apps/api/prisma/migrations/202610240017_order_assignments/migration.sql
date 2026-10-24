BEGIN;
CREATE TABLE order_assignment_history (
 id UUID PRIMARY KEY, order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 previous_staff_id UUID, assigned_staff_id UUID, actor_id UUID NOT NULL,
 action VARCHAR(16) NOT NULL CHECK(action IN ('CLAIM','ASSIGN')), reason VARCHAR(500),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(previous_staff_id IS DISTINCT FROM assigned_staff_id),
 CHECK(action <> 'CLAIM' OR (previous_staff_id IS NULL AND assigned_staff_id = actor_id))
);
CREATE INDEX order_assignment_history_order_id_created_at_id_idx ON order_assignment_history(order_id,created_at,id);
CREATE TRIGGER order_assignment_history_immutable BEFORE UPDATE OR DELETE ON order_assignment_history FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER order_assignment_history_no_truncate BEFORE TRUNCATE ON order_assignment_history FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
