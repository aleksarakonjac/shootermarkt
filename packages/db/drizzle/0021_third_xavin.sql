ALTER TABLE "competitions" ADD COLUMN "timezone" varchar(100) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "remark" varchar(10);