BEGIN;
CREATE TABLE order_completions (
 order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
 completed_at TIMESTAMPTZ(3) NOT NULL, completed_by UUID NOT NULL,
 approval_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK(approval_status='PENDING_APPROVAL'),
 rate_employee_id UUID, rate_policy_id UUID, rate_snapshot NUMERIC(65,30), policy_effective_at TIMESTAMPTZ(3),
 beneficiary_id UUID, beneficiary_state VARCHAR(16) NOT NULL CHECK(beneficiary_state IN ('RESOLVED','UNRESOLVED')),
 CHECK(rate_snapshot IS NULL OR (rate_snapshot>=0 AND rate_snapshot<>'NaN'::numeric)),
 CHECK((rate_snapshot IS NULL)=(rate_policy_id IS NULL)), CHECK((rate_snapshot IS NULL)=(policy_effective_at IS NULL)),
 CHECK(rate_snapshot IS NULL OR rate_employee_id IS NOT NULL), CHECK(policy_effective_at IS NULL OR policy_effective_at<=completed_at),
 CHECK((beneficiary_state='RESOLVED')=(beneficiary_id IS NOT NULL))
);
CREATE TRIGGER order_completions_immutable BEFORE UPDATE OR DELETE ON order_completions FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER order_completions_no_truncate BEFORE TRUNCATE ON order_completions FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
CREATE FUNCTION protect_completed_order() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='COMPLETED' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.completed_by IS DISTINCT FROM OLD.completed_by
   OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.order_code IS DISTINCT FROM OLD.order_code OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by)
 THEN RAISE EXCEPTION 'Completed order facts are immutable' USING ERRCODE='23514'; END IF;
 IF OLD.beneficiary_needs_decision AND NOT NEW.beneficiary_needs_decision THEN RAISE EXCEPTION 'Beneficiary decision cannot be cleared by this workflow' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER orders_protect_completed BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION protect_completed_order();
CREATE FUNCTION protect_completed_items() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE current_status "OrderStatus";
BEGIN
 SELECT status INTO current_status FROM orders WHERE id=NEW.order_id FOR UPDATE;
 IF current_status='COMPLETED' THEN RAISE EXCEPTION 'Completed order items are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_items_no_completed_insert BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION protect_completed_items();
COMMIT;
