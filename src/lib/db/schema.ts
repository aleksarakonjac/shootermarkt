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
  date,
  pgEnum,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ── Enums ─────────────────────────────────────────────────────────────────────

export const disciplineCodeEnum = pgEnum("discipline_code", [
  // 10m Air
  "ARM",  // Air Rifle Men
  "ARW",  // Air Rifle Women
  "APM",  // Air Pistol Men
  "APW",  // Air Pistol Women
  // 50m Rifle (MK Puška)
  "R3PM", // Rifle 3-Position Men (3x40 Senior)
  "R3PW", // Rifle 3-Position Women (3x40 Senior)
  "R3JM", // Rifle 3-Position Junior Men (3x20)
  "R3JW", // Rifle 3-Position Junior Women (3x20)
  // Pistol
  "SPW",  // 25m Sport Pistol Women
  "RFPM", // 25m Rapid Fire Pistol Men
  "FPM",  // 50m Free Pistol Men
]);

export const competitionLevelEnum = pgEnum("competition_level", [
  "club",
  "regional",
  "national",
  "international",
  "continental",
  "world",
  "olympic",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "championship",
  "world_cup",
  "champions_league",
  "cup",
  "grand_prix",
  "league_round",
  "friendly",
  "other",
]);

export const ageCategoryEnum = pgEnum("age_category", [
  "pionir",
  "kadet",
  "mladji_junior",
  "junior",
  "mladji_senior",
  "senior",
  "master",
  "open",
]);

export const scoringTypeEnum = pgEnum("scoring_type", [
  "individual",
  "team",
  "both",
]);

export const structureTypeEnum = pgEnum("structure_type", [
  "series",
  "positions_series",
]);

export const resultSourceEnum = pgEnum("result_source", [
  "pdf_import",
  "manual",
  "issf_import",
  "esc_import",
]);

// ── JSONB Type Definitions ────────────────────────────────────────────────────

export type SeriesStructureDef = {
  seriesCount: number;
  shotsPerSeries: number;
  maxPerSeries: number;
};

export type PositionEntry = {
  code: "kneeling" | "prone" | "standing";
  shots: number;
  series: number;
  maxPerSeries: number;
  max: number;
};

export type PositionsStructureDef = {
  positions: PositionEntry[];
};

export type StructureDef = SeriesStructureDef | PositionsStructureDef;

export type ArApFinalStructureDef = {
  format: "ar_ap_10m";
  phase1Series: number;       // 2
  phase1ShotsEach: number;    // 5
  phase2MaxShots: number;     // 14
  startShooters: number;      // 8
};

export type PositionsFinalStructureDef = {
  format: "3x20_mk" | "3x40_mk";
  phase1: {
    kneeling: { shots: number };
    prone: { shots: number };
    standing: { series: number; shotsEach: number };
  };
  phase1EliminateRanks: number[]; // [7, 8]
  phase2StartShooters: number;    // 6
};

export type FinalStructureDef = ArApFinalStructureDef | PositionsFinalStructureDef;

// Qual detail stored per result
export type SeriesQualDetail = {
  series: number[];
};

export type PositionsQualDetail = {
  kneeling: { series: number[][]; total: number };
  prone:    { series: number[][]; total: number };
  standing: { series: number[][]; total: number };
};

export type QualDetail = SeriesQualDetail | PositionsQualDetail;

// Final detail stored per result
export type ArApFinalDetail = {
  format: "ar_ap_10m";
  phase1: {
    series: [number[], number[]]; // 2 series of 5 shots
    subtotal: number;
  };
  phase2: {
    shots: number[];
    eliminatedAfterShot: number | null; // null = not eliminated (stayed to end)
  };
  total: number;
};

export type PositionsFinalDetail = {
  format: "3x20_mk" | "3x40_mk";
  phase1: {
    kneeling: { shots: number[]; total: number };
    prone:    { shots: number[]; total: number };
    standing: { series1: number[]; series2: number[]; total: number };
    subtotal: number;
  };
  phase1Eliminations: number[]; // ranks eliminated, e.g. [7, 8]
  phase2: {
    shots: number[];
    eliminatedAfterShot: number | null;
  };
  total: number;
};

/** Granularni tok finala iz PDF biltena, kada format ne može pouzdano da se
 * preslika u jednu od standardnih ISSF struktura iznad. */
export type BulletinFinalDetail = {
  format: "bulletin";
  /** SPW finale beleži broj pogodaka po seriji i kumulativno, ne decimalne hice. */
  scoring?: "decimal" | "hit_count";
  /** Zbirovi po prikazanoj seriji/fazi finala. */
  series?: number[];
  /** Nazivi serija/faza, npr. Klečeći, Ležeći, Stojeći 1, Stojeći 2. */
  seriesLabels?: string[];
  /** Pojedinačni hici, ako su eksplicitno navedeni u PDF-u. */
  shots?: number[];
  /** Kumulativni rezultat posle svakog prikazanog hica/faze. */
  cumulative?: number[];
};

export type FinalDetail = ArApFinalDetail | PositionsFinalDetail | BulletinFinalDetail;

// ── Countries ─────────────────────────────────────────────────────────────────

export const countries = pgTable(
  "countries",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 3 }).notNull().unique(),  // ISO 3166-1 alpha-3
    code2: varchar("code2", { length: 2 }),                   // alpha-2 (flag emoji, URLs)
    name: varchar("name", { length: 100 }).notNull(),
    nocCode: varchar("noc_code", { length: 10 }),
    flagUrl: text("flag_url"),
  },
  (t) => [
    uniqueIndex("countries_code_idx").on(t.code),
  ]
);

// ── Disciplines ───────────────────────────────────────────────────────────────

export const disciplines = pgTable("disciplines", {
  id: serial("id").primaryKey(),
  code: disciplineCodeEnum("code").notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  shortName: varchar("short_name", { length: 30 }),
  gender: varchar("gender", { length: 1 }), // 'M' | 'F' | null (open/mixed)
  distance: smallint("distance"),            // meters: 10, 25, 50
  apparatus: varchar("apparatus", { length: 20 }), // 'air_rifle' | 'air_pistol' | 'rifle' | 'pistol'
  // Default ISSF standard max score (denormalized for quick access in forma score computation)
  maxQualScore: decimal("max_qual_score", { precision: 7, scale: 1 }).notNull().default("600"),
});

// ── Discipline Variants ───────────────────────────────────────────────────────

export const disciplineVariants = pgTable(
  "discipline_variants",
  {
    id: serial("id").primaryKey(),
    disciplineId: integer("discipline_id").notNull().references(() => disciplines.id),
    code: varchar("code", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    totalShots: smallint("total_shots").notNull(),
    maxScore: decimal("max_score", { precision: 7, scale: 1 }).notNull(),
    hasDecimals: boolean("has_decimals").notNull().default(true),
    structureType: structureTypeEnum("structure_type").notNull(),
    structureDef: jsonb("structure_def").$type<StructureDef>().notNull(),
    qualDisplayType: varchar("qual_display_type", { length: 30 }).notNull(),  // 'series_6' | 'series_4' | 'positions_3x2' | 'positions_3x4'
    finalDisplayType: varchar("final_display_type", { length: 30 }),          // 'ar_ap_10m' | '3x20_mk' | '3x40_mk' | null
    finalStructureDef: jsonb("final_structure_def").$type<FinalStructureDef>(),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [
    index("discipline_variants_discipline_id_idx").on(t.disciplineId),
  ]
);

// ── Clubs ─────────────────────────────────────────────────────────────────────

export const clubs = pgTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    shortName: varchar("short_name", { length: 50 }),
    city: varchar("city", { length: 100 }),
    countryId: integer("country_id").references(() => countries.id),
    countryCode: varchar("country_code", { length: 3 }), // kept for legacy/quick access
    nocCode: varchar("noc_code", { length: 20 }),
    sssId: varchar("sss_id", { length: 50 }),
    foundedYear: smallint("founded_year"),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("clubs_country_id_idx").on(t.countryId),
  ]
);

// ── Club Memberships ──────────────────────────────────────────────────────────

export const clubMemberships = pgTable(
  "club_memberships",
  {
    id: serial("id").primaryKey(),
    shooterId: integer("shooter_id").notNull().references(() => shooters.id),
    clubId: integer("club_id").notNull().references(() => clubs.id),
    fromDate: varchar("from_date", { length: 10 }), // YYYY-MM-DD
    toDate: varchar("to_date", { length: 10 }),     // null = current member
    transferType: varchar("transfer_type", { length: 20 }).default("registered"),
  },
  (t) => [
    index("club_memberships_shooter_idx").on(t.shooterId),
    index("club_memberships_club_idx").on(t.clubId),
  ]
);

// ── Shooters ──────────────────────────────────────────────────────────────────

export const shooters = pgTable(
  "shooters",
  {
    id: serial("id").primaryKey(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    birthYear: smallint("birth_year"),
    birthDate: date("birth_date"),
    apparatus: varchar("apparatus", { length: 10 }),
    gender: varchar("gender", { length: 1 }),
    // Denormalized current club (source of truth: club_memberships)
    clubId: integer("club_id").references(() => clubs.id),
    countryId: integer("country_id").references(() => countries.id),
    // licenseNumber removed — was license_number, not used
    nationality: varchar("nationality", { length: 3 }), // ISO alpha-3 (legacy + quick access)
    createdBySelf: boolean("created_by_self").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    avatarUrl: text("avatar_url"),
    supabaseUserId: text("supabase_user_id").unique(),
    issfId: varchar("issf_id", { length: 50 }).unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("shooters_last_name_idx").on(t.lastName),
    index("shooters_club_id_idx").on(t.clubId),
    index("shooters_country_id_idx").on(t.countryId),
    index("shooters_nationality_idx").on(t.nationality),
  ]
);

// ── National Teams ────────────────────────────────────────────────────────────

export const nationalTeams = pgTable(
  "national_teams",
  {
    id: serial("id").primaryKey(),
    countryId: integer("country_id").notNull().references(() => countries.id),
    disciplineId: integer("discipline_id").references(() => disciplines.id), // null = all disciplines
    name: varchar("name", { length: 100 }).notNull(),
    shortName: varchar("short_name", { length: 30 }),
  },
  (t) => [
    index("national_teams_country_idx").on(t.countryId),
    uniqueIndex("national_teams_country_discipline_unique").on(t.countryId, t.disciplineId),
  ]
);

export const nationalTeamMemberships = pgTable(
  "national_team_memberships",
  {
    id: serial("id").primaryKey(),
    shooterId: integer("shooter_id").notNull().references(() => shooters.id),
    nationalTeamId: integer("national_team_id").notNull().references(() => nationalTeams.id),
    fromDate: varchar("from_date", { length: 10 }),
    toDate: varchar("to_date", { length: 10 }), // null = active member
    role: varchar("role", { length: 20 }).default("member"), // 'member' | 'captain'
  },
  (t) => [
    index("ntm_shooter_idx").on(t.shooterId),
    index("ntm_team_idx").on(t.nationalTeamId),
  ]
);

// ── Leagues ───────────────────────────────────────────────────────────────────

export const leagues = pgTable(
  "leagues",
  {
    id: serial("id").primaryKey(),
    countryId: integer("country_id").references(() => countries.id),
    disciplineId: integer("discipline_id").references(() => disciplines.id),
    defaultVariantId: integer("default_variant_id").references(() => disciplineVariants.id),
    name: varchar("name", { length: 200 }).notNull(),
    shortName: varchar("short_name", { length: 50 }),
    foundedYear: smallint("founded_year"),
    scoringType: scoringTypeEnum("scoring_type").notNull().default("individual"),
    teamSize: smallint("team_size"),
    pointsForWin: smallint("points_for_win").notNull().default(2),
    pointsForDraw: smallint("points_for_draw").notNull().default(1),
    pointsForLoss: smallint("points_for_loss").notNull().default(0),
  },
  (t) => [
    index("leagues_country_idx").on(t.countryId),
  ]
);

export const leagueSeasons = pgTable(
  "league_seasons",
  {
    id: serial("id").primaryKey(),
    leagueId: integer("league_id").notNull().references(() => leagues.id),
    year: smallint("year").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'finished'
    totalRounds: smallint("total_rounds"),
  },
  (t) => [
    uniqueIndex("league_seasons_league_year_unique").on(t.leagueId, t.year),
  ]
);

// ── Competitions ──────────────────────────────────────────────────────────────

export const competitions = pgTable(
  "competitions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 300 }).notNull(),
    nameSr: varchar("name_sr", { length: 300 }),         // Serbian translation (if original is English)
    nameEn: varchar("name_en", { length: 300 }),         // English translation (if original is Serbian)
    date: varchar("date", { length: 10 }).notNull(),     // YYYY-MM-DD start date
    dateEnd: varchar("date_end", { length: 10 }),        // YYYY-MM-DD, null = single day
    location: varchar("location", { length: 200 }),
    countryId: integer("country_id").references(() => countries.id), // null = ISSF/international
    level: competitionLevelEnum("level").notNull(),
    eventType: eventTypeEnum("event_type").notNull().default("other"),
    ageCategory: ageCategoryEnum("age_category").notNull().default("open"),
    organizer: varchar("organizer", { length: 50 }), // 'ISSF' | 'ESC' | 'SSS' | 'DSB' ...
    // League linkage
    leagueSeasonId: integer("league_season_id").references(() => leagueSeasons.id),
    roundNumber: smallint("round_number"),
    // Forma score weight: auto-set on insert, admin can override
    formaWeight: decimal("forma_weight", { precision: 3, scale: 2 }).notNull().default("0.35"),
    sourcePdfUrl: text("source_pdf_url"),
    issfId: varchar("issf_id", { length: 50 }).unique(),
    externalId: varchar("external_id", { length: 300 }),
    tags: varchar("tags", { length: 20 }).array().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("competitions_date_idx").on(t.date),
    index("competitions_level_idx").on(t.level),
    index("competitions_country_id_idx").on(t.countryId),
    index("competitions_league_season_idx").on(t.leagueSeasonId),
    uniqueIndex("competitions_external_id_uidx").on(t.externalId).where(sql`${t.externalId} IS NOT NULL`),
  ]
);

// ── League Standings ──────────────────────────────────────────────────────────

export const leagueStandings = pgTable(
  "league_standings",
  {
    id: serial("id").primaryKey(),
    leagueSeasonId: integer("league_season_id").notNull().references(() => leagueSeasons.id),
    clubId: integer("club_id").notNull().references(() => clubs.id),
    rank: integer("rank"),
    points: integer("points").notNull().default(0),
    matchesPlayed: integer("matches_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    totalScore: decimal("total_score", { precision: 10, scale: 1 }),
    avgScore: decimal("avg_score", { precision: 6, scale: 1 }),
  },
  (t) => [
    uniqueIndex("league_standings_season_club_unique").on(t.leagueSeasonId, t.clubId),
    index("league_standings_season_idx").on(t.leagueSeasonId),
  ]
);

// ── Results ───────────────────────────────────────────────────────────────────

export const results = pgTable(
  "results",
  {
    id: serial("id").primaryKey(),
    shooterId: integer("shooter_id").notNull().references(() => shooters.id),
    competitionId: integer("competition_id").notNull().references(() => competitions.id),
    disciplineId: integer("discipline_id").notNull().references(() => disciplines.id),
    disciplineVariantId: integer("discipline_variant_id").references(() => disciplineVariants.id),

    // Exactly one should be set: club (club context) OR country (national team context)
    clubId: integer("club_id").references(() => clubs.id),
    countryId: integer("country_id").references(() => countries.id),

    // Uzrasna kategorija pod kojom je rezultat postignut (iz biltena)
    category: ageCategoryEnum("category").notNull().default("senior"),

    // Qualification
    qualTotal: decimal("qual_total", { precision: 6, scale: 1 }),
    qualInners: integer("qual_inners"),
    qualRank: integer("qual_rank"),
    qualDetail: jsonb("qual_detail").$type<QualDetail>(),

    // Final
    qualified: boolean("qualified"),
    finalTotal: decimal("final_total", { precision: 7, scale: 1 }),
    finalRank: integer("final_rank"),
    finalDetail: jsonb("final_detail").$type<FinalDetail>(),

    // Snapshot of competition forma_weight at time of recording (for audit/history)
    formaWeightSnapshot: decimal("forma_weight_snapshot", { precision: 3, scale: 2 }),

    source: resultSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("results_shooter_id_idx").on(t.shooterId),
    index("results_competition_id_idx").on(t.competitionId),
    index("results_discipline_id_idx").on(t.disciplineId),
    // Dozvoljava dva odvojena meča iste discipline (junior + senior) na istom
    // takmičenju kad su različiti rezultati; isti rezultat se dedup-uje pre unosa.
    uniqueIndex("results_shooter_comp_disc_cat_unique").on(
      t.shooterId,
      t.competitionId,
      t.disciplineId,
      t.category
    ),
  ]
);

// ── PDF Import Jobs ──────────────────────────────────────────────────────────

export const pdfImportJobs = pgTable(
  "pdf_import_jobs",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id").notNull().references(() => competitions.id),
    status: varchar("status", { length: 20 }).notNull().default("queued"),
    // Legacy fallback for imports created before PDFs moved to Storage.
    pdfData: bytea("pdf_data"),
    pdfStoragePath: varchar("pdf_storage_path", { length: 500 }),
    pdfDeletedAt: timestamp("pdf_deleted_at"),
    sourceUrl: varchar("source_url", { length: 1000 }),
    sourceLabel: varchar("source_label", { length: 500 }),
    tags: varchar("tags", { length: 20 }).array().notNull().default([]),
    result: jsonb("result").$type<unknown>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("pdf_import_jobs_status_idx").on(t.status),
    index("pdf_import_jobs_competition_idx").on(t.competitionId),
  ]
);


// ── Competition Schedule ──────────────────────────────────────────────────────

export const competitionSchedule = pgTable(
  "competition_schedule",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
    disciplineId: integer("discipline_id").notNull().references(() => disciplines.id),
    stage: varchar("stage", { length: 30 }).notNull(), // 'qual'|'qual_rapid'|'qual_precision'|'elimination'|'final'
    category: ageCategoryEnum("category").notNull().default("senior"),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("competition_schedule_comp_idx").on(t.competitionId),
    index("competition_schedule_start_idx").on(t.startTime),
  ]
);

// ── Ticker Live Overrides ─────────────────────────────────────────────────────

export const tickerLiveOverrides = pgTable(
  "ticker_live_overrides",
  {
    id: serial("id").primaryKey(),
    // type: 'live' = forced live, 'uskoro' = forced uskoro, 'article' = news article, 'custom' = free text
    type: varchar("type", { length: 20 }).notNull().default("live"),
    competitionId: integer("competition_id").references(() => competitions.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    customSlides: jsonb("custom_slides").$type<Array<{ label?: string; text: string }>>(),
    priority: integer("priority").notNull().default(0),
    label: varchar("label", { length: 200 }),
    href: varchar("href", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ticker_overrides_comp_idx").on(t.competitionId),
  ]
);

// ── Ticker Custom Upcoming ────────────────────────────────────────────────────

export const tickerCustomUpcoming = pgTable(
  "ticker_custom_upcoming",
  {
    id: serial("id").primaryKey(),
    text: varchar("text", { length: 300 }).notNull(),
    date: varchar("date", { length: 10 }),
    href: varchar("href", { length: 500 }),
    displayUntil: varchar("display_until", { length: 10 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

// ── Forma Cache ───────────────────────────────────────────────────────────────
// Pre-computed per (shooter, discipline_code). Refreshed on every result commit.

export const shooterFormaCache = pgTable(
  "shooter_forma_cache",
  {
    id: serial("id").primaryKey(),
    shooterId: integer("shooter_id").notNull().references(() => shooters.id, { onDelete: "cascade" }),
    disciplineCode: varchar("discipline_code", { length: 10 }).notNull(),
    forma: decimal("forma", { precision: 6, scale: 1 }),
    level: decimal("level", { precision: 6, scale: 1 }),
    reliability: decimal("reliability", { precision: 6, scale: 1 }),
    trend: varchar("trend", { length: 10 }),
    momentum: decimal("momentum", { precision: 10, scale: 6 }),
    peak: decimal("peak", { precision: 6, scale: 1 }),
    peakProximity: decimal("peak_proximity", { precision: 7, scale: 6 }),
    consistency: decimal("consistency", { precision: 7, scale: 6 }),
    sampleSize: integer("sample_size").notNull().default(0),
    lowConfidence: boolean("low_confidence").notNull().default(true),
    // Career stats (deterministic, period-independent)
    peakCareer: decimal("peak_career", { precision: 6, scale: 1 }),
    best3Career: decimal("best3_career", { precision: 6, scale: 1 }),
    recent3Career: decimal("recent3_career", { precision: 6, scale: 1 }),
    seasonAvg: decimal("season_avg", { precision: 6, scale: 1 }),
    prevSeasonAvg: decimal("prev_season_avg", { precision: 6, scale: 1 }),
    improvement: decimal("improvement", { precision: 5, scale: 1 }),
    seasonCount: integer("season_count").notNull().default(0),
    careerCount: integer("career_count").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shooter_forma_cache_shooter_disc_unique").on(t.shooterId, t.disciplineCode),
    index("shooter_forma_cache_discipline_idx").on(t.disciplineCode),
    index("shooter_forma_cache_forma_idx").on(t.disciplineCode, t.forma),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const countryRelations = relations(countries, ({ many }) => ({
  clubs: many(clubs),
  competitions: many(competitions),
  nationalTeams: many(nationalTeams),
  shooters: many(shooters),
}));

export const disciplineRelations = relations(disciplines, ({ many }) => ({
  variants: many(disciplineVariants),
  results: many(results),
  nationalTeams: many(nationalTeams),
  leagues: many(leagues),
  scheduleSlots: many(competitionSchedule),
}));

export const disciplineVariantRelations = relations(disciplineVariants, ({ one, many }) => ({
  discipline: one(disciplines, {
    fields: [disciplineVariants.disciplineId],
    references: [disciplines.id],
  }),
  results: many(results),
}));

export const clubRelations = relations(clubs, ({ one, many }) => ({
  country: one(countries, { fields: [clubs.countryId], references: [countries.id] }),
  shooters: many(shooters),
  memberships: many(clubMemberships),
  leagueStandings: many(leagueStandings),
  results: many(results),
}));

export const clubMembershipRelations = relations(clubMemberships, ({ one }) => ({
  shooter: one(shooters, { fields: [clubMemberships.shooterId], references: [shooters.id] }),
  club: one(clubs, { fields: [clubMemberships.clubId], references: [clubs.id] }),
}));

export const shooterRelations = relations(shooters, ({ one, many }) => ({
  club: one(clubs, { fields: [shooters.clubId], references: [clubs.id] }),
  country: one(countries, { fields: [shooters.countryId], references: [countries.id] }),
  results: many(results),
  clubMemberships: many(clubMemberships),
  nationalTeamMemberships: many(nationalTeamMemberships),
}));

export const nationalTeamRelations = relations(nationalTeams, ({ one, many }) => ({
  country: one(countries, { fields: [nationalTeams.countryId], references: [countries.id] }),
  discipline: one(disciplines, { fields: [nationalTeams.disciplineId], references: [disciplines.id] }),
  memberships: many(nationalTeamMemberships),
}));

export const nationalTeamMembershipRelations = relations(nationalTeamMemberships, ({ one }) => ({
  shooter: one(shooters, { fields: [nationalTeamMemberships.shooterId], references: [shooters.id] }),
  nationalTeam: one(nationalTeams, { fields: [nationalTeamMemberships.nationalTeamId], references: [nationalTeams.id] }),
}));

export const leagueRelations = relations(leagues, ({ one, many }) => ({
  country: one(countries, { fields: [leagues.countryId], references: [countries.id] }),
  discipline: one(disciplines, { fields: [leagues.disciplineId], references: [disciplines.id] }),
  defaultVariant: one(disciplineVariants, { fields: [leagues.defaultVariantId], references: [disciplineVariants.id] }),
  seasons: many(leagueSeasons),
}));

export const leagueSeasonRelations = relations(leagueSeasons, ({ one, many }) => ({
  league: one(leagues, { fields: [leagueSeasons.leagueId], references: [leagues.id] }),
  competitions: many(competitions),
  standings: many(leagueStandings),
}));

export const leagueStandingRelations = relations(leagueStandings, ({ one }) => ({
  leagueSeason: one(leagueSeasons, { fields: [leagueStandings.leagueSeasonId], references: [leagueSeasons.id] }),
  club: one(clubs, { fields: [leagueStandings.clubId], references: [clubs.id] }),
}));

export const competitionRelations = relations(competitions, ({ one, many }) => ({
  country: one(countries, { fields: [competitions.countryId], references: [countries.id] }),
  leagueSeason: one(leagueSeasons, { fields: [competitions.leagueSeasonId], references: [leagueSeasons.id] }),
  results: many(results),
  schedule: many(competitionSchedule),
  liveOverrides: many(tickerLiveOverrides),
}));

export const competitionScheduleRelations = relations(competitionSchedule, ({ one }) => ({
  competition: one(competitions, { fields: [competitionSchedule.competitionId], references: [competitions.id] }),
  discipline: one(disciplines, { fields: [competitionSchedule.disciplineId], references: [disciplines.id] }),
}));

export const tickerLiveOverrideRelations = relations(tickerLiveOverrides, ({ one }) => ({
  competition: one(competitions, { fields: [tickerLiveOverrides.competitionId], references: [competitions.id] }),
}));

export const shooterFormaCacheRelations = relations(shooterFormaCache, ({ one }) => ({
  shooter: one(shooters, { fields: [shooterFormaCache.shooterId], references: [shooters.id] }),
}));

export const resultRelations = relations(results, ({ one }) => ({
  shooter: one(shooters, { fields: [results.shooterId], references: [shooters.id] }),
  competition: one(competitions, { fields: [results.competitionId], references: [competitions.id] }),
  discipline: one(disciplines, { fields: [results.disciplineId], references: [disciplines.id] }),
  disciplineVariant: one(disciplineVariants, { fields: [results.disciplineVariantId], references: [disciplineVariants.id] }),
  club: one(clubs, { fields: [results.clubId], references: [clubs.id] }),
  country: one(countries, { fields: [results.countryId], references: [countries.id] }),
}));

// ── Exported Types ────────────────────────────────────────────────────────────

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;

export type Discipline = typeof disciplines.$inferSelect;
export type NewDiscipline = typeof disciplines.$inferInsert;

export type DisciplineVariant = typeof disciplineVariants.$inferSelect;
export type NewDisciplineVariant = typeof disciplineVariants.$inferInsert;

export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;

export type ClubMembership = typeof clubMemberships.$inferSelect;
export type NewClubMembership = typeof clubMemberships.$inferInsert;

export type Shooter = typeof shooters.$inferSelect;
export type NewShooter = typeof shooters.$inferInsert;

export type NationalTeam = typeof nationalTeams.$inferSelect;
export type NewNationalTeam = typeof nationalTeams.$inferInsert;

export type NationalTeamMembership = typeof nationalTeamMemberships.$inferSelect;
export type NewNationalTeamMembership = typeof nationalTeamMemberships.$inferInsert;

export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;

export type LeagueSeason = typeof leagueSeasons.$inferSelect;
export type NewLeagueSeason = typeof leagueSeasons.$inferInsert;

export type LeagueStanding = typeof leagueStandings.$inferSelect;
export type NewLeagueStanding = typeof leagueStandings.$inferInsert;

export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;

export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;

export type CompetitionScheduleSlot = typeof competitionSchedule.$inferSelect;
export type NewCompetitionScheduleSlot = typeof competitionSchedule.$inferInsert;

export type TickerLiveOverride = typeof tickerLiveOverrides.$inferSelect;
export type NewTickerLiveOverride = typeof tickerLiveOverrides.$inferInsert;

export type TickerCustomUpcoming = typeof tickerCustomUpcoming.$inferSelect;
export type NewTickerCustomUpcoming = typeof tickerCustomUpcoming.$inferInsert;

// Convenience union types for level/eventType
export type CompetitionLevel = typeof competitionLevelEnum.enumValues[number];
export type EventType = typeof eventTypeEnum.enumValues[number];
export type AgeCategory = typeof ageCategoryEnum.enumValues[number];
export type DisciplineCode = typeof disciplineCodeEnum.enumValues[number];
