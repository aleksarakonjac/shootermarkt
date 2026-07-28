CREATE TABLE IF NOT EXISTS "issf_import_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  "current" integer NOT NULL DEFAULT 0,
  "total" integer NOT NULL,
  "current_noc" varchar(3),
  "inserted" integer NOT NULL DEFAULT 0,
  "skipped" integer NOT NULL DEFAULT 0,
  "error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "started_at" timestamp,
  "completed_at" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issf_import_jobs_status_idx" ON "issf_import_jobs" ("status");
