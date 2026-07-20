DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'discipline_code'::regtype AND enumlabel = 'ARMT'
  ) THEN
    ALTER TYPE "public"."discipline_code" ADD VALUE 'ARMT';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'discipline_code'::regtype AND enumlabel = 'APMT'
  ) THEN
    ALTER TYPE "public"."discipline_code" ADD VALUE 'APMT';
  END IF;
END $$;
--> statement-breakpoint

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
--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_shooter1_id_shooters_id_fk" FOREIGN KEY ("shooter1_id") REFERENCES "public"."shooters"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD CONSTRAINT "mixed_team_results_shooter2_id_shooters_id_fk" FOREIGN KEY ("shooter2_id") REFERENCES "public"."shooters"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mixed_team_results_comp_idx" ON "mixed_team_results" USING btree ("competition_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mixed_team_results_comp_disc_noc_unique" ON "mixed_team_results" USING btree ("competition_id","discipline_id","noc_code");
