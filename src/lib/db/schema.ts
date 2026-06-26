import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  smallint,
  decimal,
  jsonb,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const disciplineCodeEnum = pgEnum("discipline_code", [
  "ARM",
  "ARW",
  "APM",
  "APW",
]);

export const competitionLevelEnum = pgEnum("competition_level", [
  "drzavno",
  "kup",
  "regionalno",
  "medjunarodno",
]);

export const resultSourceEnum = pgEnum("result_source", [
  "pdf_import",
  "manual",
]);

// ── Disciplines ───────────────────────────────────────────────────────────────

export const disciplines = pgTable("disciplines", {
  id: serial("id").primaryKey(),
  code: disciplineCodeEnum("code").notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  maxQualScore: decimal("max_qual_score", { precision: 6, scale: 1 }).notNull(),
  hasDecimals: boolean("has_decimals").notNull().default(false),
  seriesCount: smallint("series_count").notNull().default(6),
});

// ── Clubs ─────────────────────────────────────────────────────────────────────

export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  city: varchar("city", { length: 100 }),
  countryCode: varchar("country_code", { length: 3 }), // ISO 3166-1 alpha-3: SRB, GER, KOR
  nocCode: varchar("noc_code", { length: 20 }),         // federation/club abbreviation
  sssId: varchar("sss_id", { length: 50 }),
});

// ── Shooters ──────────────────────────────────────────────────────────────────

export const shooters = pgTable(
  "shooters",
  {
    id: serial("id").primaryKey(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    birthYear: smallint("birth_year"),
    gender: varchar("gender", { length: 1 }), // 'M' | 'F'
    clubId: integer("club_id").references(() => clubs.id),
    licenseNumber: varchar("license_number", { length: 50 }),
    nationality: varchar("nationality", { length: 3 }), // ISO 3166-1 alpha-3: SRB, GER, KOR
    createdBySelf: boolean("created_by_self").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    avatarUrl: text("avatar_url"),
    supabaseUserId: text("supabase_user_id").unique(), // null if admin-created
    issfId: varchar("issf_id", { length: 50 }).unique(), // ISSF athlete ID e.g. SHSRBM...
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("shooters_last_name_idx").on(t.lastName),
    index("shooters_club_id_idx").on(t.clubId),
    index("shooters_nationality_idx").on(t.nationality),
  ]
);

// ── Competitions ──────────────────────────────────────────────────────────────

export const competitions = pgTable("competitions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD, stored as varchar to avoid tz issues
  location: varchar("location", { length: 200 }),
  level: competitionLevelEnum("level").notNull(),
  sourcePdfUrl: text("source_pdf_url"),
  issfId: varchar("issf_id", { length: 20 }).unique(), // ISSF competition ID, prevents re-import
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Results ───────────────────────────────────────────────────────────────────

export const results = pgTable(
  "results",
  {
    id: serial("id").primaryKey(),
    shooterId: integer("shooter_id")
      .notNull()
      .references(() => shooters.id),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id),
    disciplineId: integer("discipline_id")
      .notNull()
      .references(() => disciplines.id),
    qualTotal: decimal("qual_total", { precision: 6, scale: 1 }),
    qualInners: integer("qual_inners"), // X count, AP only
    qualRank: integer("qual_rank"),
    qualSeries: jsonb("qual_series").$type<number[]>(), // [105.3, 105.8, ...]
    qualified: boolean("qualified"),
    finalTotal: decimal("final_total", { precision: 6, scale: 1 }),
    finalRank: integer("final_rank"),
    source: resultSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("results_shooter_id_idx").on(t.shooterId),
    index("results_competition_id_idx").on(t.competitionId),
    index("results_discipline_id_idx").on(t.disciplineId),
    uniqueIndex("results_shooter_comp_disc_unique").on(
      t.shooterId,
      t.competitionId,
      t.disciplineId
    ),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const shooterRelations = relations(shooters, ({ one, many }) => ({
  club: one(clubs, { fields: [shooters.clubId], references: [clubs.id] }),
  results: many(results),
}));

export const clubRelations = relations(clubs, ({ many }) => ({
  shooters: many(shooters),
}));

export const competitionRelations = relations(competitions, ({ many }) => ({
  results: many(results),
}));

export const disciplineRelations = relations(disciplines, ({ many }) => ({
  results: many(results),
}));

export const resultRelations = relations(results, ({ one }) => ({
  shooter: one(shooters, {
    fields: [results.shooterId],
    references: [shooters.id],
  }),
  competition: one(competitions, {
    fields: [results.competitionId],
    references: [competitions.id],
  }),
  discipline: one(disciplines, {
    fields: [results.disciplineId],
    references: [disciplines.id],
  }),
}));

// ── Calendar Alerts ───────────────────────────────────────────────────────────

export const calendarAlerts = pgTable("calendar_alerts", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 20 }).notNull(), // 'sss' | 'issf' | 'esc'
  eventName: text("event_name").notNull(),
  changeType: varchar("change_type", { length: 20 }).notNull(), // 'new' | 'removed'
  data: jsonb("data").$type<{
    dateFrom?: string;
    dateTo?: string;
    location?: string;
    country?: string;
    url?: string;
    externalId?: string;
  }>(),
  seen: boolean("seen").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CalendarAlert = typeof calendarAlerts.$inferSelect;
export type NewCalendarAlert = typeof calendarAlerts.$inferInsert;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Discipline = typeof disciplines.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type Shooter = typeof shooters.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type Result = typeof results.$inferSelect;

export type NewShooter = typeof shooters.$inferInsert;
export type NewCompetition = typeof competitions.$inferInsert;
export type NewResult = typeof results.$inferInsert;
