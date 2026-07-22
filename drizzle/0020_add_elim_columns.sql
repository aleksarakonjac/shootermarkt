ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "elim_round" integer;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "elim_total" integer;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "elim_rank" integer;--> statement-breakpoint
ALTER TABLE "shooters" ADD COLUMN IF NOT EXISTS "sius_athlete_id" varchar(50);--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shooters_sius_athlete_id_unique'
  ) THEN
    ALTER TABLE "shooters" ADD CONSTRAINT "shooters_sius_athlete_id_unique" UNIQUE("sius_athlete_id");
  END IF;
END $$;
