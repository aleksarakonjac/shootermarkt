-- Idempotent — safe to re-run, skips what already exists

-- Enum types
DO $$ BEGIN CREATE TYPE "public"."age_category" AS ENUM('pionir','kadet','mladji_junior','junior','mladji_senior','senior','master','open'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."competition_level" AS ENUM('club','regional','national','continental','world','olympic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."discipline_code" AS ENUM('ARM','ARW','APM','APW','R3PM','R3PW','R3JM','R3JW','SPW','RFPM','FPM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."event_type" AS ENUM('championship','world_cup','champions_league','cup','grand_prix','league_round','friendly','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."result_source" AS ENUM('pdf_import','manual','issf_import','esc_import'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."scoring_type" AS ENUM('individual','team','both'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."structure_type" AS ENUM('series','positions_series'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables (dependency order)
CREATE TABLE IF NOT EXISTS "calendar_alerts" ("id" serial PRIMARY KEY NOT NULL,"source" varchar(20) NOT NULL,"event_name" text NOT NULL,"change_type" varchar(20) NOT NULL,"data" jsonb,"seen" boolean DEFAULT false NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "countries" ("id" serial PRIMARY KEY NOT NULL,"code" varchar(3) NOT NULL,"code2" varchar(2),"name" varchar(100) NOT NULL,"noc_code" varchar(10),"flag_url" text,CONSTRAINT "countries_code_unique" UNIQUE("code"));
CREATE TABLE IF NOT EXISTS "disciplines" ("id" serial PRIMARY KEY NOT NULL,"code" "discipline_code" NOT NULL,"name" varchar(100) NOT NULL,"short_name" varchar(30),"gender" varchar(1),"distance" smallint,"apparatus" varchar(20),"max_qual_score" numeric(7,1) DEFAULT '600' NOT NULL,CONSTRAINT "disciplines_code_unique" UNIQUE("code"));
CREATE TABLE IF NOT EXISTS "clubs" ("id" serial PRIMARY KEY NOT NULL,"name" varchar(200) NOT NULL,"short_name" varchar(50),"city" varchar(100),"country_id" integer,"country_code" varchar(3),"noc_code" varchar(20),"sss_id" varchar(50),"founded_year" smallint,"logo_url" text,"created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "leagues" ("id" serial PRIMARY KEY NOT NULL,"country_id" integer,"discipline_id" integer,"default_variant_id" integer,"name" varchar(200) NOT NULL,"short_name" varchar(50),"founded_year" smallint,"scoring_type" "scoring_type" DEFAULT 'individual' NOT NULL,"team_size" smallint,"points_for_win" smallint DEFAULT 2 NOT NULL,"points_for_draw" smallint DEFAULT 1 NOT NULL,"points_for_loss" smallint DEFAULT 0 NOT NULL);
CREATE TABLE IF NOT EXISTS "discipline_variants" ("id" serial PRIMARY KEY NOT NULL,"discipline_id" integer NOT NULL,"code" varchar(40) NOT NULL,"name" varchar(100) NOT NULL,"total_shots" smallint NOT NULL,"max_score" numeric(7,1) NOT NULL,"has_decimals" boolean DEFAULT true NOT NULL,"structure_type" "structure_type" NOT NULL,"structure_def" jsonb NOT NULL,"qual_display_type" varchar(30) NOT NULL,"final_display_type" varchar(30),"final_structure_def" jsonb,"is_default" boolean DEFAULT false NOT NULL,CONSTRAINT "discipline_variants_code_unique" UNIQUE("code"));
CREATE TABLE IF NOT EXISTS "league_seasons" ("id" serial PRIMARY KEY NOT NULL,"league_id" integer NOT NULL,"year" smallint NOT NULL,"status" varchar(20) DEFAULT 'active' NOT NULL,"total_rounds" smallint);
CREATE TABLE IF NOT EXISTS "league_standings" ("id" serial PRIMARY KEY NOT NULL,"league_season_id" integer NOT NULL,"club_id" integer NOT NULL,"rank" integer,"points" integer DEFAULT 0 NOT NULL,"matches_played" integer DEFAULT 0 NOT NULL,"wins" integer DEFAULT 0 NOT NULL,"draws" integer DEFAULT 0 NOT NULL,"losses" integer DEFAULT 0 NOT NULL,"total_score" numeric(10,1),"avg_score" numeric(6,1));
CREATE TABLE IF NOT EXISTS "national_teams" ("id" serial PRIMARY KEY NOT NULL,"country_id" integer NOT NULL,"discipline_id" integer,"name" varchar(100) NOT NULL,"short_name" varchar(30));
CREATE TABLE IF NOT EXISTS "shooters" ("id" serial PRIMARY KEY NOT NULL,"first_name" varchar(100) NOT NULL,"last_name" varchar(100) NOT NULL,"birth_year" smallint,"gender" varchar(1),"club_id" integer,"country_id" integer,"license_number" varchar(50),"nationality" varchar(3),"created_by_self" boolean DEFAULT false NOT NULL,"verified" boolean DEFAULT false NOT NULL,"avatar_url" text,"supabase_user_id" text,"issf_id" varchar(50),"created_at" timestamp DEFAULT now() NOT NULL,CONSTRAINT "shooters_supabase_user_id_unique" UNIQUE("supabase_user_id"),CONSTRAINT "shooters_issf_id_unique" UNIQUE("issf_id"));
CREATE TABLE IF NOT EXISTS "competitions" ("id" serial PRIMARY KEY NOT NULL,"name" varchar(300) NOT NULL,"date" varchar(10) NOT NULL,"date_end" varchar(10),"location" varchar(200),"country_id" integer,"level" "competition_level" NOT NULL,"event_type" "event_type" DEFAULT 'other' NOT NULL,"age_category" "age_category" DEFAULT 'open' NOT NULL,"organizer" varchar(50),"league_season_id" integer,"round_number" smallint,"forma_weight" numeric(3,2) DEFAULT '0.35' NOT NULL,"source_pdf_url" text,"issf_id" varchar(50),"external_id" varchar(100),"created_at" timestamp DEFAULT now() NOT NULL,CONSTRAINT "competitions_issf_id_unique" UNIQUE("issf_id"));
CREATE TABLE IF NOT EXISTS "club_memberships" ("id" serial PRIMARY KEY NOT NULL,"shooter_id" integer NOT NULL,"club_id" integer NOT NULL,"from_date" varchar(10),"to_date" varchar(10),"transfer_type" varchar(20) DEFAULT 'registered');
CREATE TABLE IF NOT EXISTS "national_team_memberships" ("id" serial PRIMARY KEY NOT NULL,"shooter_id" integer NOT NULL,"national_team_id" integer NOT NULL,"from_date" varchar(10),"to_date" varchar(10),"role" varchar(20) DEFAULT 'member');
CREATE TABLE IF NOT EXISTS "results" ("id" serial PRIMARY KEY NOT NULL,"shooter_id" integer NOT NULL,"competition_id" integer NOT NULL,"discipline_id" integer NOT NULL,"discipline_variant_id" integer,"club_id" integer,"country_id" integer,"qual_total" numeric(6,1),"qual_inners" integer,"qual_rank" integer,"qual_detail" jsonb,"qualified" boolean,"final_total" numeric(7,1),"final_rank" integer,"final_detail" jsonb,"forma_weight_snapshot" numeric(3,2),"source" "result_source" DEFAULT 'manual' NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL);

-- Foreign keys
DO $$ BEGIN ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "shooters"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clubs" ADD CONSTRAINT "clubs_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "competitions" ADD CONSTRAINT "competitions_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "competitions" ADD CONSTRAINT "competitions_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "league_seasons"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "discipline_variants" ADD CONSTRAINT "discipline_variants_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "league_seasons" ADD CONSTRAINT "league_seasons_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "leagues"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "league_standings" ADD CONSTRAINT "league_standings_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "league_seasons"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "league_standings" ADD CONSTRAINT "league_standings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "leagues" ADD CONSTRAINT "leagues_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "leagues" ADD CONSTRAINT "leagues_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "leagues" ADD CONSTRAINT "leagues_default_variant_id_discipline_variants_id_fk" FOREIGN KEY ("default_variant_id") REFERENCES "discipline_variants"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "national_team_memberships" ADD CONSTRAINT "national_team_memberships_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "shooters"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "national_team_memberships" ADD CONSTRAINT "national_team_memberships_national_team_id_national_teams_id_fk" FOREIGN KEY ("national_team_id") REFERENCES "national_teams"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "national_teams" ADD CONSTRAINT "national_teams_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "national_teams" ADD CONSTRAINT "national_teams_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "results" ADD CONSTRAINT "results_shooter_id_shooters_id_fk" FOREIGN KEY ("shooter_id") REFERENCES "shooters"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "results" ADD CONSTRAINT "results_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "results" ADD CONSTRAINT "results_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "results" ADD CONSTRAINT "results_discipline_variant_id_discipline_variants_id_fk" FOREIGN KEY ("discipline_variant_id") REFERENCES "discipline_variants"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "results" ADD CONSTRAINT "results_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "results" ADD CONSTRAINT "results_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shooters" ADD CONSTRAINT "shooters_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shooters" ADD CONSTRAINT "shooters_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "club_memberships_shooter_idx" ON "club_memberships" USING btree ("shooter_id");
CREATE INDEX IF NOT EXISTS "club_memberships_club_idx" ON "club_memberships" USING btree ("club_id");
CREATE INDEX IF NOT EXISTS "clubs_country_id_idx" ON "clubs" USING btree ("country_id");
CREATE INDEX IF NOT EXISTS "competitions_date_idx" ON "competitions" USING btree ("date");
CREATE INDEX IF NOT EXISTS "competitions_level_idx" ON "competitions" USING btree ("level");
CREATE INDEX IF NOT EXISTS "competitions_country_id_idx" ON "competitions" USING btree ("country_id");
CREATE INDEX IF NOT EXISTS "competitions_league_season_idx" ON "competitions" USING btree ("league_season_id");
CREATE UNIQUE INDEX IF NOT EXISTS "countries_code_idx" ON "countries" USING btree ("code");
CREATE INDEX IF NOT EXISTS "discipline_variants_discipline_id_idx" ON "discipline_variants" USING btree ("discipline_id");
CREATE UNIQUE INDEX IF NOT EXISTS "league_seasons_league_year_unique" ON "league_seasons" USING btree ("league_id","year");
CREATE UNIQUE INDEX IF NOT EXISTS "league_standings_season_club_unique" ON "league_standings" USING btree ("league_season_id","club_id");
CREATE INDEX IF NOT EXISTS "league_standings_season_idx" ON "league_standings" USING btree ("league_season_id");
CREATE INDEX IF NOT EXISTS "leagues_country_idx" ON "leagues" USING btree ("country_id");
CREATE INDEX IF NOT EXISTS "ntm_shooter_idx" ON "national_team_memberships" USING btree ("shooter_id");
CREATE INDEX IF NOT EXISTS "ntm_team_idx" ON "national_team_memberships" USING btree ("national_team_id");
CREATE INDEX IF NOT EXISTS "national_teams_country_idx" ON "national_teams" USING btree ("country_id");
CREATE UNIQUE INDEX IF NOT EXISTS "national_teams_country_discipline_unique" ON "national_teams" USING btree ("country_id","discipline_id");
CREATE INDEX IF NOT EXISTS "results_shooter_id_idx" ON "results" USING btree ("shooter_id");
CREATE INDEX IF NOT EXISTS "results_competition_id_idx" ON "results" USING btree ("competition_id");
CREATE INDEX IF NOT EXISTS "results_discipline_id_idx" ON "results" USING btree ("discipline_id");
CREATE UNIQUE INDEX IF NOT EXISTS "results_shooter_comp_disc_unique" ON "results" USING btree ("shooter_id","competition_id","discipline_id");
CREATE INDEX IF NOT EXISTS "shooters_last_name_idx" ON "shooters" USING btree ("last_name");
CREATE INDEX IF NOT EXISTS "shooters_club_id_idx" ON "shooters" USING btree ("club_id");
CREATE INDEX IF NOT EXISTS "shooters_country_id_idx" ON "shooters" USING btree ("country_id");
CREATE INDEX IF NOT EXISTS "shooters_nationality_idx" ON "shooters" USING btree ("nationality");
