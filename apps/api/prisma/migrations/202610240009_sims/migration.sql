BEGIN;
CREATE TYPE "SimStockStatus" AS ENUM('AVAILABLE','RESERVED','SOLD');
CREATE TABLE sims (
 id UUID PRIMARY KEY,
 phone_number VARCHAR(32) NOT NULL CHECK(phone_number ~ '^[0-9]{1,32}$'),
 carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
 category_id UUID NOT NULL REFERENCES sim_categories(id) ON DELETE RESTRICT,
 cost_price NUMERIC(65,30) NOT NULL CHECK(cost_price>=0 AND cost_price<>'NaN'::numeric),
 selling_price NUMERIC(65,30) NOT NULL CHECK(selling_price>=0 AND selling_price<>'NaN'::numeric),
 stock_status "SimStockStatus" NOT NULL DEFAULT 'AVAILABLE',
 is_visible BOOLEAN NOT NULL DEFAULT false,
 deleted_at TIMESTAMPTZ(3), error_confirmed_at TIMESTAMPTZ(3), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_by UUID, updated_by UUID,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT sims_visible_price_safe CHECK(NOT is_visible OR selling_price>cost_price)
);
-- Partial uniqueness belongs to versioned SQL: Prisma has no blanket unique phone field across archived history.
CREATE UNIQUE INDEX sims_active_phone_number_key ON sims(phone_number) WHERE deleted_at IS NULL;
COMMIT;
