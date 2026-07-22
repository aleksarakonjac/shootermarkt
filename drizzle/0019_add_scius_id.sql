ALTER TABLE "competitions" ADD COLUMN "scius_id" varchar(50);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_scius_id_unique" UNIQUE("scius_id");