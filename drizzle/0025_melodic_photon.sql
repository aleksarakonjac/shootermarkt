DROP INDEX "mixed_team_results_comp_disc_noc_unique";--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD COLUMN "team_number" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD COLUMN "qual_inners" integer;--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD COLUMN "qual_remark" varchar(10);--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD COLUMN "final_remark" varchar(200);--> statement-breakpoint
CREATE UNIQUE INDEX "mixed_team_results_comp_disc_noc_unique" ON "mixed_team_results" USING btree ("competition_id","discipline_id","noc_code","team_number");