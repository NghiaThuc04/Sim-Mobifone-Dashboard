BEGIN;
CREATE TABLE sim_removal_logs (
 id UUID PRIMARY KEY,
 sim_id UUID NOT NULL UNIQUE REFERENCES sims(id) ON DELETE RESTRICT,
 phone_number_snapshot VARCHAR(32) NOT NULL CHECK(phone_number_snapshot ~ '^[0-9]{1,32}$'),
 actor_id UUID NOT NULL,
 reason VARCHAR(500) CHECK(reason IS NULL OR length(trim(reason)) > 0),
 before JSONB NOT NULL CHECK(jsonb_typeof(before)='object' AND octet_length(before::text)<=8192),
 removed_at TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX sim_removal_logs_removed_at_idx ON sim_removal_logs(removed_at);
CREATE TRIGGER sim_removal_logs_immutable BEFORE UPDATE OR DELETE ON sim_removal_logs FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER sim_removal_logs_no_truncate BEFORE TRUNCATE ON sim_removal_logs FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
