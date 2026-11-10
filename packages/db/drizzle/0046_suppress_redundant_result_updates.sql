-- Live-fetch cron upsertuje celo takmičenje svakog minuta. Bez ovoga svaki red dobija UPDATE
-- (i kad se ništa ne promeni) → WAL → Supabase Realtime šalje ceo red svakom pretplaćenom
-- posetiocu = egress. Ugrađeni trigger preskače UPDATE kad je novi red identičan starom,
-- pa nepromenjeni red ne ide ni u RETURNING.
DROP TRIGGER IF EXISTS "z_suppress_redundant_updates" ON "results";--> statement-breakpoint
CREATE TRIGGER "z_suppress_redundant_updates" BEFORE UPDATE ON "results"
  FOR EACH ROW EXECUTE FUNCTION suppress_redundant_updates_trigger();--> statement-breakpoint
DROP TRIGGER IF EXISTS "z_suppress_redundant_updates" ON "mixed_team_results";--> statement-breakpoint
CREATE TRIGGER "z_suppress_redundant_updates" BEFORE UPDATE ON "mixed_team_results"
  FOR EACH ROW EXECUTE FUNCTION suppress_redundant_updates_trigger();
