CREATE TABLE "team_result_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_result_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"shooter_id" integer,
	"name" varchar(200) NOT NULL,
	"series" jsonb NOT NULL,
	"total" numeric(6, 1) NOT NULL,
	"inners" integer
);
--> statement-breakpoint
CREATE TABLE "team_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"competition_event_id" integer,
	"discipline_id" integer NOT NULL,
	"category" "age_category" DEFAULT 'senior' NOT NULL,
	"team_name" varchar(200) NOT NULL,
	"rank" integer,
	"total" numeric(7, 1),
	"inners" integer,
	"remark" varchar(10),
	"source" "result_source" DEFAULT 'pdf_import' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_results_comp_event_disc_cat_name_unique" UNIQUE NULLS NOT DISTINCT("competition_id","competition_event_id","discipline_id","category","team_name")
);
--> statement-breakpoint
ALTER TABLE "mixed_team_results" ADD COLUMN "club_name" varchar(200);--> statement-breakpoint
ALTER TABLE "team_result_members" ADD CONSTRAINT "team_result_members_team_result_id_team_results_id_fk" FOREIGN KEY ("team_result_id") REFERENCES "public"."team_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_result_members" ADD CONSTRAINT "team_result_members_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "public"."shooters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_results" ADD CONSTRAINT "team_results_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_results" ADD CONSTRAINT "team_results_competition_event_id_competition_events_id_fk" FOREIGN KEY ("competition_event_id") REFERENCES "public"."competition_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_results" ADD CONSTRAINT "team_results_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_result_members_team_idx" ON "team_result_members" USING btree ("team_result_id");--> statement-breakpoint
CREATE INDEX "team_result_members_shooter_idx" ON "team_result_members" USING btree ("shooter_id");--> statement-breakpoint
CREATE INDEX "team_results_comp_idx" ON "team_results" USING btree ("competition_id");