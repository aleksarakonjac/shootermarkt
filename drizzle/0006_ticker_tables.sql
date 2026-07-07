-- competition_schedule: per (competition × discipline × stage) time slots
CREATE TABLE IF NOT EXISTS "competition_schedule" (
  "id" serial PRIMARY KEY,
  "competition_id" integer NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "discipline_id" integer NOT NULL REFERENCES "disciplines"("id"),
  "stage" varchar(30) NOT NULL,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "competition_schedule_comp_idx" ON "competition_schedule"("competition_id");
CREATE INDEX IF NOT EXISTS "competition_schedule_start_idx" ON "competition_schedule"("start_time");

--> statement-breakpoint

-- ticker_live_overrides: admin-forced live activations
CREATE TABLE IF NOT EXISTS "ticker_live_overrides" (
  "id" serial PRIMARY KEY,
  "competition_id" integer REFERENCES "competitions"("id") ON DELETE SET NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "custom_slides" jsonb,
  "priority" integer NOT NULL DEFAULT 0,
  "label" varchar(200),
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ticker_overrides_comp_idx" ON "ticker_live_overrides"("competition_id");

--> statement-breakpoint

-- ticker_custom_upcoming: manual entries in the bottom upcoming bar
CREATE TABLE IF NOT EXISTS "ticker_custom_upcoming" (
  "id" serial PRIMARY KEY,
  "text" varchar(300) NOT NULL,
  "date" varchar(10),
  "href" varchar(500),
  "display_until" varchar(10),
  "created_at" timestamp NOT NULL DEFAULT now()
);
