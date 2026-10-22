CREATE TABLE "competition_schedule_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"kind" varchar(12) NOT NULL,
	"discipline_id" integer,
	"stage" varchar(30),
	"category" "age_category",
	"before_start" timestamp,
	"before_end" timestamp,
	"after_start" timestamp,
	"after_end" timestamp,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "competition_schedule_changes" ADD CONSTRAINT "competition_schedule_changes_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_schedule_changes" ADD CONSTRAINT "competition_schedule_changes_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_schedule_changes_open_idx" ON "competition_schedule_changes" USING btree ("acknowledged_at");