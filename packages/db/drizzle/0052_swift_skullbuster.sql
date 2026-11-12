CREATE TABLE "competition_schedule_extras" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"kind" varchar(12) NOT NULL,
	"title" varchar(200) NOT NULL,
	"discipline_id" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition_schedule_extras" ADD CONSTRAINT "competition_schedule_extras_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_schedule_extras" ADD CONSTRAINT "competition_schedule_extras_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_schedule_extras_comp_idx" ON "competition_schedule_extras" USING btree ("competition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_schedule_extras_unique" ON "competition_schedule_extras" USING btree ("competition_id","title","start_time");