BEGIN;
CREATE TABLE order_create_keys (
 actor_id UUID NOT NULL,
 idempotency_key UUID NOT NULL,
 request_hash CHAR(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
 response JSONB NOT NULL CHECK(jsonb_typeof(response)='object' AND octet_length(response::text)<=1024),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(actor_id,idempotency_key)
);
CREATE TRIGGER order_create_keys_immutable BEFORE UPDATE OR DELETE ON order_create_keys FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER order_create_keys_no_truncate BEFORE TRUNCATE ON order_create_keys FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
