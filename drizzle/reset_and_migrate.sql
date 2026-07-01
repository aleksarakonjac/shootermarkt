-- Drop existing types if they exist
DROP TYPE IF EXISTS "public"."age_category" CASCADE;
DROP TYPE IF EXISTS "public"."competition_level" CASCADE;
DROP TYPE IF EXISTS "public"."discipline_code" CASCADE;
DROP TYPE IF EXISTS "public"."event_type" CASCADE;
DROP TYPE IF EXISTS "public"."result_source" CASCADE;
DROP TYPE IF EXISTS "public"."scoring_type" CASCADE;
DROP TYPE IF EXISTS "public"."structure_type" CASCADE;

-- Drop existing tables if they exist (in FK-safe order)
DROP TABLE IF EXISTS "results" CASCADE;
DROP TABLE IF EXISTS "national_team_memberships" CASCADE;
DROP TABLE IF EXISTS "club_memberships" CASCADE;
DROP TABLE IF EXISTS "league_standings" CASCADE;
DROP TABLE IF EXISTS "league_seasons" CASCADE;
DROP TABLE IF EXISTS "discipline_variants" CASCADE;
DROP TABLE IF EXISTS "shooters" CASCADE;
DROP TABLE IF EXISTS "competitions" CASCADE;
DROP TABLE IF EXISTS "national_teams" CASCADE;
DROP TABLE IF EXISTS "leagues" CASCADE;
DROP TABLE IF EXISTS "clubs" CASCADE;
DROP TABLE IF EXISTS "disciplines" CASCADE;
DROP TABLE IF EXISTS "countries" CASCADE;
DROP TABLE IF EXISTS "calendar_alerts" CASCADE;
