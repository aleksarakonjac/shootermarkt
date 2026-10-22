CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "shooters_first_name_trgm_idx" ON "shooters" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "shooters_last_name_trgm_idx" ON "shooters" USING gin ("last_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "shooters_previous_last_names_idx" ON "shooters" USING btree ("previous_last_names") WHERE "shooters"."previous_last_names" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shooters_last_name_fold_idx" ON "shooters" USING btree (regexp_replace(replace(translate(lower(regexp_replace(normalize("last_name", NFD), U&'[\0300-\036F]', '', 'g')), 'Đđ', 'dd'), 'dj', 'd'), '[^a-z]', '', 'g'));