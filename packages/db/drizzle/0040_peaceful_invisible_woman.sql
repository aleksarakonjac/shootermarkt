CREATE TABLE "competition_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"date" varchar(10) NOT NULL
);
--> statement-breakpoint
DROP INDEX "results_shooter_comp_disc_cat_unique";--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "competition_event_id" integer;--> statement-breakpoint
ALTER TABLE "competition_events" ADD CONSTRAINT "competition_events_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_events_comp_name_unique" ON "competition_events" USING btree ("competition_id","name");--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_competition_event_id_competition_events_id_fk" FOREIGN KEY ("competition_event_id") REFERENCES "public"."competition_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_shooter_comp_event_disc_cat_unique" UNIQUE NULLS NOT DISTINCT("shooter_id","competition_id","competition_event_id","discipline_id","category");