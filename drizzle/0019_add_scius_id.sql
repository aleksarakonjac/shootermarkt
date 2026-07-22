ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "scius_id" varchar(50);
DO $$ BEGIN
  ALTER TABLE "competitions" ADD CONSTRAINT "competitions_scius_id_unique" UNIQUE("scius_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
