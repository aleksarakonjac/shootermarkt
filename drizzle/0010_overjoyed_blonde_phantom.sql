ALTER TABLE "competition_schedule" ADD COLUMN IF NOT EXISTS "category" "age_category" DEFAULT 'senior' NOT NULL;
--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "category" "age_category" DEFAULT 'senior' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "results_shooter_comp_disc_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "results_shooter_comp_disc_cat_unique" ON "results" USING btree ("shooter_id","competition_id","discipline_id","category");
