BEGIN;
CREATE TABLE sim_changes (
 id UUID PRIMARY KEY,sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE RESTRICT,actor_id UUID NOT NULL,
 before JSONB NOT NULL CHECK(jsonb_typeof(before)='object' AND octet_length(before::text)<=8192),
 after JSONB NOT NULL CHECK(jsonb_typeof(after)='object' AND octet_length(after::text)<=8192),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sim_changes_sim_id_created_at_idx ON sim_changes(sim_id,created_at);
CREATE TRIGGER sim_changes_immutable BEFORE UPDATE OR DELETE ON sim_changes FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER sim_changes_no_truncate BEFORE TRUNCATE ON sim_changes FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
