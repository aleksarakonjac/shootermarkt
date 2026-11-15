CREATE TABLE "homepage_focus_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" varchar(10) NOT NULL,
	"competition_id" integer NOT NULL,
	"position" smallint,
	"hidden" boolean DEFAULT false NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homepage_focus_overrides" ADD CONSTRAINT "homepage_focus_overrides_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_focus_overrides_scope_comp_idx" ON "homepage_focus_overrides" USING btree ("scope","competition_id");