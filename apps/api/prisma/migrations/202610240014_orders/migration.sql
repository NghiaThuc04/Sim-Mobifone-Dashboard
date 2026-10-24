BEGIN;
CREATE TYPE "OrderStatus" AS ENUM ('PENDING','CONFIRMED','PROCESSING','COMPLETED','CANCELLED');
CREATE TABLE customers (
 id UUID PRIMARY KEY,
 full_name VARCHAR(150) NOT NULL CHECK(length(btrim(full_name))>0),
 phone VARCHAR(33) NOT NULL CHECK(phone ~ '^\+?[0-9]{1,32}$'),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE orders (
 id UUID PRIMARY KEY,
 order_code VARCHAR(64) NOT NULL UNIQUE CHECK(length(btrim(order_code))>0),
 customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
 status "OrderStatus" NOT NULL DEFAULT 'PENDING',
 assigned_staff_id UUID, claimed_at TIMESTAMPTZ(3), completed_at TIMESTAMPTZ(3), completed_by UUID,
 created_by UUID NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(claimed_at IS NULL OR assigned_staff_id IS NOT NULL),
 CHECK((completed_at IS NULL)=(completed_by IS NULL)),
 CHECK((status='COMPLETED')=(completed_at IS NOT NULL))
);
-- Actor IDs retain historical identity like audit_logs; assigning/completing requires future server workflows.
CREATE INDEX orders_created_at_id_idx ON orders(created_at,id);
CREATE INDEX orders_status_created_at_id_idx ON orders(status,created_at,id);
CREATE INDEX orders_assigned_staff_id_created_at_id_idx ON orders(assigned_staff_id,created_at,id);
CREATE TABLE order_items (
 id UUID PRIMARY KEY,
 order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE RESTRICT,
 phone_number_snapshot VARCHAR(32) NOT NULL CHECK(phone_number_snapshot ~ '^[0-9]{1,32}$'),
 selling_price_snapshot NUMERIC(65,30) NOT NULL CHECK(selling_price_snapshot>=0 AND selling_price_snapshot<>'NaN'::numeric),
 cost_price_snapshot NUMERIC(65,30) NOT NULL CHECK(cost_price_snapshot>=0 AND cost_price_snapshot<>'NaN'::numeric),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(order_id,sim_id)
);
CREATE INDEX order_items_phone_number_snapshot_order_id_idx ON order_items(phone_number_snapshot,order_id);
CREATE INDEX order_items_sim_id_idx ON order_items(sim_id);
CREATE TRIGGER order_items_immutable BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER order_items_no_truncate BEFORE TRUNCATE ON order_items FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
