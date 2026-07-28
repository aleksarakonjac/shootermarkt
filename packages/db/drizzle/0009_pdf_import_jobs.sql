CREATE TABLE IF NOT EXISTS "pdf_import_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "competition_id" integer NOT NULL REFERENCES "competitions"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  "pdf_data" bytea NOT NULL,
  "result" jsonb,
  "error" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "started_at" timestamp,
  "completed_at" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pdf_import_jobs_status_idx" ON "pdf_import_jobs" ("status");
CREATE INDEX IF NOT EXISTS "pdf_import_jobs_competition_idx" ON "pdf_import_jobs" ("competition_id");
