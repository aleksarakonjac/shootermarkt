ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "timezone" varchar(100) NOT NULL DEFAULT 'UTC';
