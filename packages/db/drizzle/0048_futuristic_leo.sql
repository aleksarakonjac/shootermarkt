CREATE TABLE "olympic_quota_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"discipline_id" integer NOT NULL,
	"games" varchar(10) DEFAULT 'LA2028' NOT NULL,
	"places" smallint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "olympic_quota_allocations" ADD CONSTRAINT "olympic_quota_allocations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "olympic_quota_allocations" ADD CONSTRAINT "olympic_quota_allocations_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "olympic_quota_allocations_unique" ON "olympic_quota_allocations" USING btree ("competition_id","discipline_id","games");