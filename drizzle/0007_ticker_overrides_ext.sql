ALTER TABLE "ticker_live_overrides" ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'live';
--> statement-breakpoint
ALTER TABLE "ticker_live_overrides" ADD COLUMN IF NOT EXISTS "href" varchar(500);
