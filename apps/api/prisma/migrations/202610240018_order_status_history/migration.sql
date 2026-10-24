BEGIN;
CREATE TABLE order_status_history (
 id UUID PRIMARY KEY, order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT, actor_id UUID NOT NULL,
 previous_status "OrderStatus" NOT NULL, status "OrderStatus" NOT NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(previous_status<>status)
);
CREATE INDEX order_status_history_order_id_created_at_id_idx ON order_status_history(order_id,created_at,id);
CREATE TRIGGER order_status_history_immutable BEFORE UPDATE OR DELETE ON order_status_history FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER order_status_history_no_truncate BEFORE TRUNCATE ON order_status_history FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
