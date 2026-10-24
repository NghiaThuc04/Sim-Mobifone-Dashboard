CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_token_hash_format" CHECK ("token_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "auth_sessions_expiry" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

CREATE TABLE "auth_login_limits" (
  "key" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "auth_login_limits_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "auth_login_limits_attempts_positive" CHECK ("attempts" > 0)
);
CREATE INDEX "auth_login_limits_expires_at_idx" ON "auth_login_limits"("expires_at");
