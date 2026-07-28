-- idempotent: enum values
DO $$ BEGIN
  ALTER TYPE "public"."discipline_code" ADD VALUE IF NOT EXISTS 'ARMT' BEFORE 'R3PM';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "public"."discipline_code" ADD VALUE IF NOT EXISTS 'APMT' BEFORE 'R3PM';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- idempotent: tables
CREATE TABLE IF NOT EXISTS "issf_import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"current_noc" varchar(3),
	"inserted" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mixed_team_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"discipline_id" integer NOT NULL,
	"noc_code" varchar(3) NOT NULL,
	"shooter1_id" integer,
	"shooter2_id" integer,
	"shooter1_issf_id" varchar(50),
	"shooter2_issf_id" varchar(50),
	"shooter1_name" varchar(200),
	"shooter2_name" varchar(200),
	"shooter1_detail" jsonb,
	"shooter2_detail" jsonb,
	"qual_rank" integer,
	"qual_total" numeric(7, 1),
	"qualified" boolean,
	"final_rank" integer,
	"final_total" numeric(7, 1),
	"source" "result_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- idempotent: foreign keys
DO $$ BEGIN
  ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_competition_id_competitions_id_fk"
    FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_discipline_id_disciplines_id_fk"
    FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_shooter1_id_shooters_id_fk"
    FOREIGN KEY ("shooter1_id") REFERENCES "public"."shooters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_shooter2_id_shooters_id_fk"
    FOREIGN KEY ("shooter2_id") REFERENCES "public"."shooters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- idempotent: indexes
CREATE INDEX IF NOT EXISTS "issf_import_jobs_status_idx" ON "issf_import_jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "mixed_team_results_comp_idx" ON "mixed_team_results" USING btree ("competition_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mixed_team_results_comp_disc_noc_unique" ON "mixed_team_results" USING btree ("competition_id","discipline_id","noc_code");
CREATE INDEX IF NOT EXISTS "shooters_verified_apparatus_name_idx" ON "shooters" USING btree ("apparatus","last_name","first_name") WHERE "shooters"."verified" = true;
