BEGIN;
CREATE TABLE inventory_reservations (
 id UUID PRIMARY KEY,
 order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE RESTRICT,
 phone_number_snapshot VARCHAR(32) NOT NULL CHECK(phone_number_snapshot ~ '^[0-9]{1,32}$'),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 released_at TIMESTAMPTZ(3),
 CHECK(released_at IS NULL OR released_at>=created_at)
);
CREATE UNIQUE INDEX inventory_reservations_one_active_sim_key ON inventory_reservations(sim_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX inventory_reservations_one_active_phone_key ON inventory_reservations(phone_number_snapshot) WHERE released_at IS NULL;
CREATE INDEX inventory_reservations_order_id_idx ON inventory_reservations(order_id);
COMMIT;
