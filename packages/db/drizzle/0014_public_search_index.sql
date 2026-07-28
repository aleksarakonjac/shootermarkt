CREATE INDEX IF NOT EXISTS "shooters_verified_apparatus_name_idx"
  ON "shooters" USING btree ("apparatus", "last_name", "first_name")
  WHERE "verified" = true;
