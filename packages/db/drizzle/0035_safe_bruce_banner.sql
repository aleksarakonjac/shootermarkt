DROP INDEX "mixed_team_results_comp_disc_noc_unique";--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD COLUMN "category" "age_category" DEFAULT 'senior' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mixed_team_results_comp_disc_cat_noc_unique" ON "mixed_team_results" USING btree ("competition_id","discipline_id","category","noc_code","team_number");