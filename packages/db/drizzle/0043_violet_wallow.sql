ALTER TYPE "public"."discipline_code" ADD VALUE IF NOT EXISTS 'RPRM' BEFORE 'SPW';--> statement-breakpoint
ALTER TYPE "public"."discipline_code" ADD VALUE IF NOT EXISTS 'RPRW' BEFORE 'SPW';--> statement-breakpoint
ALTER TYPE "public"."discipline_code" ADD VALUE IF NOT EXISTS 'SPM' BEFORE 'RFPM';
