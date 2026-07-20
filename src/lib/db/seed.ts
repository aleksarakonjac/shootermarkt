import { db } from "./index";
import {
  countries,
  disciplines,
  disciplineVariants,
} from "./schema";
import type {
  SeriesStructureDef,
  PositionsStructureDef,
  ArApFinalStructureDef,
  PositionsFinalStructureDef,
} from "./schema";

async function seed() {
  // ── Countries ───────────────────────────────────────────────────────────────
  console.log("Seeding countries...");
  await db
    .insert(countries)
    .values([
      { code: "SRB", code2: "RS", name: "Srbija", nocCode: "SRB" },
      { code: "DEU", code2: "DE", name: "Nemačka", nocCode: "GER" },
      { code: "CHN", code2: "CN", name: "Kina", nocCode: "CHN" },
      { code: "KOR", code2: "KR", name: "Južna Koreja", nocCode: "KOR" },
      { code: "IND", code2: "IN", name: "Indija", nocCode: "IND" },
      { code: "USA", code2: "US", name: "SAD", nocCode: "USA" },
      { code: "RUS", code2: "RU", name: "Rusija", nocCode: "RUS" },
      { code: "HUN", code2: "HU", name: "Mađarska", nocCode: "HUN" },
      { code: "AUT", code2: "AT", name: "Austrija", nocCode: "AUT" },
      { code: "CRO", code2: "HR", name: "Hrvatska", nocCode: "CRO" },
    ])
    .onConflictDoNothing();

  // ── Disciplines ─────────────────────────────────────────────────────────────
  console.log("Seeding disciplines...");
  await db
    .insert(disciplines)
    .values([
      // 10m Air Rifle
      { code: "ARM", name: "10m Air Rifle Men",   shortName: "AR Men",   gender: "M", distance: 10, apparatus: "air_rifle",  maxQualScore: "654.0" },
      { code: "ARW", name: "10m Air Rifle Women", shortName: "AR Women", gender: "F", distance: 10, apparatus: "air_rifle",  maxQualScore: "654.0" },
      // 10m Air Pistol
      { code: "APM", name: "10m Air Pistol Men",   shortName: "AP Men",   gender: "M", distance: 10, apparatus: "air_pistol", maxQualScore: "600"   },
      { code: "APW", name: "10m Air Pistol Women", shortName: "AP Women", gender: "F", distance: 10, apparatus: "air_pistol", maxQualScore: "600"   },
      // 10m Mixed Team
      { code: "ARMT", name: "10m Air Rifle Mixed Team",  shortName: "AR Mixed", gender: null, distance: 10, apparatus: "air_rifle",  maxQualScore: "1308.0" },
      { code: "APMT", name: "10m Air Pistol Mixed Team", shortName: "AP Mixed", gender: null, distance: 10, apparatus: "air_pistol", maxQualScore: "1200"   },
      // 50m Rifle (MK Puška)
      { code: "R3PM", name: "50m Rifle 3-Position Men",          shortName: "R3P Men",      gender: "M", distance: 50, apparatus: "rifle",   maxQualScore: "1308.0" },
      { code: "R3PW", name: "50m Rifle 3-Position Women",        shortName: "R3P Women",    gender: "F", distance: 50, apparatus: "rifle",   maxQualScore: "1308.0" },
      { code: "R3JM", name: "50m Rifle 3-Position Junior Men",   shortName: "R3P Jr Men",   gender: "M", distance: 50, apparatus: "rifle",   maxQualScore: "600"    },
      { code: "R3JW", name: "50m Rifle 3-Position Junior Women", shortName: "R3P Jr Women", gender: "F", distance: 50, apparatus: "rifle",   maxQualScore: "600"    },
      // Pistol
      { code: "SPW",  name: "25m Sport Pistol Women",     shortName: "SP Women", gender: "F", distance: 25, apparatus: "pistol", maxQualScore: "600"  },
      { code: "RFPM", name: "25m Rapid Fire Pistol Men",  shortName: "RFP Men",  gender: "M", distance: 25, apparatus: "pistol", maxQualScore: "600"  },
      { code: "FPM",  name: "50m Free Pistol Men",        shortName: "FP Men",   gender: "M", distance: 50, apparatus: "pistol", maxQualScore: "600"  },
    ])
    .onConflictDoNothing();

  // Fetch IDs for variant seeding
  const disciplineRows = await db.select().from(disciplines);
  const byCode = Object.fromEntries(disciplineRows.map((d) => [d.code, d.id]));

  // ── Discipline Variants ─────────────────────────────────────────────────────
  console.log("Seeding discipline variants...");

  const arApFinal: ArApFinalStructureDef = {
    format: "ar_ap_10m",
    phase1Series: 2,
    phase1ShotsEach: 5,
    phase2MaxShots: 14,
    startShooters: 8,
  };

  const mk3x20Final: PositionsFinalStructureDef = {
    format: "3x20_mk",
    phase1: {
      kneeling: { shots: 10 },
      prone:    { shots: 10 },
      standing: { series: 2, shotsEach: 5 },
    },
    phase1EliminateRanks: [7, 8],
    phase2StartShooters: 6,
  };

  const mk3x40Final: PositionsFinalStructureDef = {
    format: "3x40_mk",
    phase1: {
      kneeling: { shots: 10 },
      prone:    { shots: 10 },
      standing: { series: 2, shotsEach: 5 },
    },
    phase1EliminateRanks: [7, 8],
    phase2StartShooters: 6,
  };

  const arSeries6: SeriesStructureDef = { seriesCount: 6, shotsPerSeries: 10, maxPerSeries: 109.0 };
  const apSeries6: SeriesStructureDef = { seriesCount: 6, shotsPerSeries: 10, maxPerSeries: 100 };
  const arBundesliga: SeriesStructureDef = { seriesCount: 4, shotsPerSeries: 10, maxPerSeries: 100 };

  const positions3x20: PositionsStructureDef = {
    positions: [
      { code: "kneeling", shots: 20, series: 2, maxPerSeries: 100, max: 200 },
      { code: "prone",    shots: 20, series: 2, maxPerSeries: 100, max: 200 },
      { code: "standing", shots: 20, series: 2, maxPerSeries: 100, max: 200 },
    ],
  };

  const positions3x40: PositionsStructureDef = {
    positions: [
      { code: "kneeling", shots: 40, series: 4, maxPerSeries: 109.0, max: 436.0 },
      { code: "prone",    shots: 40, series: 4, maxPerSeries: 109.0, max: 436.0 },
      { code: "standing", shots: 40, series: 4, maxPerSeries: 109.0, max: 436.0 },
    ],
  };

  await db
    .insert(disciplineVariants)
    .values([
      // ── 10m Air Rifle Men — ISSF 60 shots decimal ──
      {
        disciplineId: byCode["ARM"],
        code: "arm-issf-60",
        name: "AR Men 60 metaka (ISSF Senior)",
        totalShots: 60,
        maxScore: "654.0",
        hasDecimals: true,
        structureType: "series",
        structureDef: arSeries6,
        qualDisplayType: "series_6",
        finalDisplayType: "ar_ap_10m",
        finalStructureDef: arApFinal,
        isDefault: true,
      },
      // ── 10m Air Rifle Men — Bundesliga 40 shots integer ──
      {
        disciplineId: byCode["ARM"],
        code: "arm-bundesliga-40",
        name: "AR Men 40 metaka (Bundesliga)",
        totalShots: 40,
        maxScore: "400",
        hasDecimals: false,
        structureType: "series",
        structureDef: arBundesliga,
        qualDisplayType: "series_4",
        finalDisplayType: null,
        finalStructureDef: null,
        isDefault: false,
      },
      // ── 10m Air Rifle Women — ISSF 60 shots decimal ──
      {
        disciplineId: byCode["ARW"],
        code: "arw-issf-60",
        name: "AR Women 60 metaka (ISSF Senior)",
        totalShots: 60,
        maxScore: "654.0",
        hasDecimals: true,
        structureType: "series",
        structureDef: arSeries6,
        qualDisplayType: "series_6",
        finalDisplayType: "ar_ap_10m",
        finalStructureDef: arApFinal,
        isDefault: true,
      },
      // ── 10m Air Pistol Men — ISSF 60 shots integer ──
      {
        disciplineId: byCode["APM"],
        code: "apm-issf-60",
        name: "AP Men 60 metaka (ISSF Senior)",
        totalShots: 60,
        maxScore: "600",
        hasDecimals: false,
        structureType: "series",
        structureDef: apSeries6,
        qualDisplayType: "series_6_inners",
        finalDisplayType: "ar_ap_10m",
        finalStructureDef: arApFinal,
        isDefault: true,
      },
      // ── 10m Air Pistol Women — ISSF 60 shots integer ──
      {
        disciplineId: byCode["APW"],
        code: "apw-issf-60",
        name: "AP Women 60 metaka (ISSF Senior)",
        totalShots: 60,
        maxScore: "600",
        hasDecimals: false,
        structureType: "series",
        structureDef: apSeries6,
        qualDisplayType: "series_6_inners",
        finalDisplayType: "ar_ap_10m",
        finalStructureDef: arApFinal,
        isDefault: true,
      },
      // ── 50m Rifle 3x20 Junior Men ──
      {
        disciplineId: byCode["R3JM"],
        code: "r3jm-3x20",
        name: "MK Puška 3×20 Junior Muškarci",
        totalShots: 60,
        maxScore: "600",
        hasDecimals: false,
        structureType: "positions_series",
        structureDef: positions3x20,
        qualDisplayType: "positions_3x2",
        finalDisplayType: "3x20_mk",
        finalStructureDef: mk3x20Final,
        isDefault: true,
      },
      // ── 50m Rifle 3x20 Junior Women ──
      {
        disciplineId: byCode["R3JW"],
        code: "r3jw-3x20",
        name: "MK Puška 3×20 Junior Žene",
        totalShots: 60,
        maxScore: "600",
        hasDecimals: false,
        structureType: "positions_series",
        structureDef: positions3x20,
        qualDisplayType: "positions_3x2",
        finalDisplayType: "3x20_mk",
        finalStructureDef: mk3x20Final,
        isDefault: true,
      },
      // ── 50m Rifle 3x40 Senior Men ──
      {
        disciplineId: byCode["R3PM"],
        code: "r3pm-3x40",
        name: "MK Puška 3×40 Senior Muškarci",
        totalShots: 120,
        maxScore: "1308.0",
        hasDecimals: true,
        structureType: "positions_series",
        structureDef: positions3x40,
        qualDisplayType: "positions_3x4",
        finalDisplayType: "3x40_mk",
        finalStructureDef: mk3x40Final,
        isDefault: true,
      },
      // ── 50m Rifle 3x40 Senior Women ──
      {
        disciplineId: byCode["R3PW"],
        code: "r3pw-3x40",
        name: "MK Puška 3×40 Senior Žene",
        totalShots: 120,
        maxScore: "1308.0",
        hasDecimals: true,
        structureType: "positions_series",
        structureDef: positions3x40,
        qualDisplayType: "positions_3x4",
        finalDisplayType: "3x40_mk",
        finalStructureDef: mk3x40Final,
        isDefault: true,
      },
    ])
    .onConflictDoNothing();

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
