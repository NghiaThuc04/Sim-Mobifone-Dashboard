BEGIN;
CREATE TABLE audit_logs (
  id UUID NOT NULL PRIMARY KEY,
  actor_id UUID,
  actor_kind VARCHAR(16) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_actor_kind CHECK (actor_kind IN ('USER', 'SYSTEM', 'ANONYMOUS')),
  CONSTRAINT audit_actor_identity CHECK ((actor_kind = 'USER') = (actor_id IS NOT NULL)),
  CONSTRAINT audit_action_nonempty CHECK (length(btrim(action)) > 0),
  CONSTRAINT audit_target_nonempty CHECK (length(btrim(target_type)) > 0),
  CONSTRAINT audit_metadata_object CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 8192)
);
CREATE INDEX audit_logs_actor_id_created_at_idx ON audit_logs(actor_id, created_at);
CREATE INDEX audit_logs_action_created_at_idx ON audit_logs(action, created_at);
CREATE INDEX audit_logs_target_type_target_id_idx ON audit_logs(target_type, target_id);

-- No FK to users: retain the original actor identity without rewriting history when a user is removed.
CREATE FUNCTION reject_audit_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are append-only';
END;
$$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
