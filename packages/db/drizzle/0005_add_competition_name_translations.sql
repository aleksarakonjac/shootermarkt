ALTER TYPE "public"."competition_level" ADD VALUE 'international' BEFORE 'continental';--> statement-breakpoint
ALTER TABLE "calendar_alerts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "calendar_alerts" CASCADE;--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "external_id" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "shooters" ALTER COLUMN "apparatus" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "name_sr" varchar(300);--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "name_en" varchar(300);--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "tags" varchar(20)[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_external_id_uidx" ON "competitions" USING btree ("external_id") WHERE "competitions"."external_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "shooters" DROP COLUMN "license_number";