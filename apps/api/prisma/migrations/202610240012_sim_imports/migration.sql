BEGIN;
CREATE TABLE sim_import_batches (
 id UUID PRIMARY KEY,created_by UUID NOT NULL,payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='array' AND octet_length(payload::text)<=2097152),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TIMESTAMPTZ(3) NOT NULL,
 confirmed_at TIMESTAMPTZ(3),selection_hash CHAR(64),result JSONB,
 CHECK(expires_at>created_at),CHECK((confirmed_at IS NULL AND selection_hash IS NULL AND result IS NULL) OR (confirmed_at IS NOT NULL AND selection_hash IS NOT NULL AND result IS NOT NULL))
);
CREATE INDEX sim_import_batches_created_by_expires_at_idx ON sim_import_batches(created_by,expires_at);
COMMIT;
