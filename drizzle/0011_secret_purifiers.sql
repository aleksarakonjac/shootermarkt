ALTER TABLE "pdf_import_jobs" ALTER COLUMN "pdf_data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pdf_import_jobs" ADD COLUMN "pdf_storage_path" varchar(500);--> statement-breakpoint
ALTER TABLE "pdf_import_jobs" ADD COLUMN "pdf_deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pdf_import_jobs_cleanup_idx"
  ON "pdf_import_jobs" ("completed_at")
  WHERE "pdf_deleted_at" IS NULL;
