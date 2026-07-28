DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'discipline_code'::regtype AND enumlabel = 'RFM') THEN
    ALTER TYPE "discipline_code" RENAME VALUE 'RFM' TO 'R3PM';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'discipline_code'::regtype AND enumlabel = 'RFW') THEN
    ALTER TYPE "discipline_code" RENAME VALUE 'RFW' TO 'R3PW';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "discipline_variants" SET "code" = 'r3pm-3x40' WHERE "code" = 'rfm-3x40';
--> statement-breakpoint
UPDATE "discipline_variants" SET "code" = 'r3pw-3x40' WHERE "code" = 'rfw-3x40';
