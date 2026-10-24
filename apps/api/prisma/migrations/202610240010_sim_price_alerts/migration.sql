BEGIN;
ALTER TABLE sims ADD COLUMN visibility_requested BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN has_price_error BOOLEAN NOT NULL DEFAULT false;
UPDATE sims SET visibility_requested=is_visible,has_price_error=(selling_price<=cost_price);
CREATE TABLE sim_price_alerts (
 id UUID PRIMARY KEY, sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE RESTRICT,
 reason VARCHAR(80) NOT NULL CHECK(reason='SELLING_NOT_ABOVE_COST'),
 cost_snapshot NUMERIC(65,30) NOT NULL CHECK(cost_snapshot>=0 AND cost_snapshot<>'NaN'::numeric),
 price_snapshot NUMERIC(65,30) NOT NULL CHECK(price_snapshot>=0 AND price_snapshot<>'NaN'::numeric),
 detected_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resolved_at TIMESTAMPTZ(3), CHECK(resolved_at IS NULL OR resolved_at>=detected_at)
);
CREATE UNIQUE INDEX sim_price_alerts_one_open ON sim_price_alerts(sim_id) WHERE resolved_at IS NULL;
INSERT INTO sim_price_alerts(id,sim_id,reason,cost_snapshot,price_snapshot)
 SELECT gen_random_uuid(),id,'SELLING_NOT_ABOVE_COST',cost_price,selling_price FROM sims WHERE has_price_error;
COMMIT;
