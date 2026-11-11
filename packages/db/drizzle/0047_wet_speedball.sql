CREATE TABLE "olympic_quotas" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" integer NOT NULL,
	"games" varchar(10) DEFAULT 'LA2028' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "olympic_quotas" ADD CONSTRAINT "olympic_quotas_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "olympic_quotas_result_games_unique" ON "olympic_quotas" USING btree ("result_id","games");