ALTER TABLE "olympic_quota_allocations" ALTER COLUMN "competition_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "olympic_quotas" ALTER COLUMN "result_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "olympic_quota_allocations" ADD COLUMN "kind" varchar(14) DEFAULT 'competition' NOT NULL;--> statement-breakpoint
ALTER TABLE "olympic_quota_allocations" ADD COLUMN "date" varchar(10);--> statement-breakpoint
ALTER TABLE "olympic_quotas" ADD COLUMN "allocation_id" integer;--> statement-breakpoint
ALTER TABLE "olympic_quotas" ADD COLUMN "shooter_id" integer;--> statement-breakpoint
ALTER TABLE "olympic_quotas" ADD CONSTRAINT "olympic_quotas_allocation_id_olympic_quota_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."olympic_quota_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "olympic_quotas" ADD CONSTRAINT "olympic_quotas_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "public"."shooters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "olympic_quota_allocations_kind_unique" ON "olympic_quota_allocations" USING btree ("kind","discipline_id","games") WHERE "olympic_quota_allocations"."competition_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "olympic_quotas_allocation_shooter_unique" ON "olympic_quotas" USING btree ("allocation_id","shooter_id");--> statement-breakpoint
ALTER TABLE "olympic_quotas" ADD CONSTRAINT "olympic_quotas_source_check" CHECK ("olympic_quotas"."result_id" IS NOT NULL OR ("olympic_quotas"."allocation_id" IS NOT NULL AND "olympic_quotas"."shooter_id" IS NOT NULL));