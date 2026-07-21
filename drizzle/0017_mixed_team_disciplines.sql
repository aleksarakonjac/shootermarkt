INSERT INTO "disciplines" ("code", "name", "short_name", "gender", "distance", "apparatus", "max_qual_score")
VALUES
  ('ARMT', '10m Air Rifle Mixed Team', 'AR Mixed', NULL, 10, 'air_rifle', 1308.0),
  ('APMT', '10m Air Pistol Mixed Team', 'AP Mixed', NULL, 10, 'air_pistol', 1200.0)
ON CONFLICT ("code") DO NOTHING;
