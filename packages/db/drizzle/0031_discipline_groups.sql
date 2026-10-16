ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "discipline_groups" varchar(12)[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint

-- 1) Grupe iz rezultata (autoritativno): disciplines.distance = 10 -> 'air', 25/50 -> 'smallbore'.
UPDATE "competitions" c
SET "discipline_groups" = sub.groups
FROM (
  SELECT x.competition_id,
         array_remove(ARRAY[
           CASE WHEN bool_or(d.distance = 10) THEN 'air' END,
           CASE WHEN bool_or(d.distance IN (25, 50)) THEN 'smallbore' END
         ], NULL) AS groups
  FROM (
    SELECT competition_id, discipline_id FROM "results"
    UNION
    SELECT competition_id, discipline_id FROM "mixed_team_results"
  ) x
  JOIN "disciplines" d ON d.id = x.discipline_id
  GROUP BY x.competition_id
) sub
WHERE c.id = sub.competition_id AND cardinality(sub.groups) > 0;
--> statement-breakpoint

-- 2) Takmičenja bez rezultata (npr. nadolazeća): grupe iz naziva. "10" mora imati "m" ("10. kolo" ne računa se).
UPDATE "competitions" c
SET "discipline_groups" = array_remove(ARRAY[
  CASE WHEN c.name ~* '(\m10\s?m\M|vazdu[sš]n|air\s+(rifle|pistol))' THEN 'air' END,
  CASE WHEN c.name ~* '(\mMK\M|malokalibar|\m(25|50)\s?m\M|small.?bore|3\s?-?position|rapid.?fire|free\s+pistol|sport\s+pistol)' THEN 'smallbore' END
], NULL)
WHERE cardinality(c."discipline_groups") = 0;
--> statement-breakpoint

-- 3) Organizator iz tagova izvora, samo kad je jednoznačan (tačno jedan od sss / issf / esc).
UPDATE "competitions" c
SET "organizer" = upper(x.src[1])
FROM (
  SELECT id,
         (SELECT array_agg(DISTINCT lower(t)) FROM unnest(tags) AS t WHERE lower(t) IN ('sss', 'issf', 'esc')) AS src
  FROM "competitions"
) x
WHERE c.id = x.id AND c."organizer" IS NULL AND cardinality(x.src) = 1;
--> statement-breakpoint

-- 4) Normalizacija tagova izvora na mala slova (admin je unosio SSS / ISSF / ESC velikim slovima).
UPDATE "competitions"
SET "tags" = ARRAY(
  SELECT DISTINCT CASE WHEN lower(t) IN ('sss', 'issf', 'esc') THEN lower(t) ELSE t END
  FROM unnest("tags") AS t
)
WHERE EXISTS (SELECT 1 FROM unnest("tags") AS t WHERE t IN ('SSS', 'ISSF', 'ESC'));
