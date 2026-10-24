CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');
CREATE TYPE "UserStatus" AS ENUM ('active', 'locked');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "full_name" VARCHAR(150) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_normalized" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "users_email_format" CHECK ("email" ~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$'),
  CONSTRAINT "users_full_name_nonempty" CHECK (length(btrim("full_name")) > 0),
  CONSTRAINT "users_password_hash_format" CHECK ("password_hash" ~ '^\$scrypt\$v1\$65536\$8\$2\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$')
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
