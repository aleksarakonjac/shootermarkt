CREATE TABLE "shooter_forma_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"shooter_id" integer NOT NULL,
	"discipline_code" varchar(10) NOT NULL,
	"forma" numeric(6, 1),
	"level" numeric(6, 1),
	"reliability" numeric(6, 1),
	"trend" varchar(10),
	"momentum" numeric(10, 6),
	"peak" numeric(6, 1),
	"peak_proximity" numeric(7, 6),
	"consistency" numeric(7, 6),
	"sample_size" integer DEFAULT 0 NOT NULL,
	"low_confidence" boolean DEFAULT true NOT NULL,
	"peak_career" numeric(6, 1),
	"best3_career" numeric(6, 1),
	"recent3_career" numeric(6, 1),
	"season_avg" numeric(6, 1),
	"prev_season_avg" numeric(6, 1),
	"improvement" numeric(5, 1),
	"season_count" integer DEFAULT 0 NOT NULL,
	"career_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shooter_forma_cache" ADD CONSTRAINT "shooter_forma_cache_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "public"."shooters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shooter_forma_cache_shooter_disc_unique" ON "shooter_forma_cache" USING btree ("shooter_id","discipline_code");--> statement-breakpoint
CREATE INDEX "shooter_forma_cache_discipline_idx" ON "shooter_forma_cache" USING btree ("discipline_code");--> statement-breakpoint
CREATE INDEX "shooter_forma_cache_forma_idx" ON "shooter_forma_cache" USING btree ("discipline_code","forma");
