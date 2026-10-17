CREATE TABLE "issf_refresh_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"total" integer NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"linked" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shooters" ADD COLUMN "issf_synced_at" timestamp;--> statement-breakpoint
CREATE INDEX "issf_refresh_jobs_status_idx" ON "issf_refresh_jobs" USING btree ("status");