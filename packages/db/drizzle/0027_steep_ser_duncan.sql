CREATE TABLE "issf_direct_import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"input" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sius_import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"input" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "issf_direct_import_jobs_status_idx" ON "issf_direct_import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sius_import_jobs_status_idx" ON "sius_import_jobs" USING btree ("status");