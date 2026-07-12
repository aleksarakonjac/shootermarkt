ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "source_url" varchar(1000);
ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "source_label" varchar(500);
ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "tags" varchar(20)[] NOT NULL DEFAULT '{}';
