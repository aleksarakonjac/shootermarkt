ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "elim_remark" varchar(10);--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "qual_remark" varchar(10);--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "final_remark" varchar(10);--> statement-breakpoint
UPDATE "results" SET "qual_remark" = "remark" WHERE "remark" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "results" DROP COLUMN IF EXISTS "remark";
