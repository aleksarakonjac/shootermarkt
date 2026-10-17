ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "remark_details" jsonb;
--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD COLUMN IF NOT EXISTS "remark_details" jsonb;
