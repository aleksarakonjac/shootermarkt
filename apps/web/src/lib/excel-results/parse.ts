import {
  CATEGORY_RANK,
  DISCIPLINE_META,
  IMPORTED_DISCIPLINE_CODES,
  type AgeCategory,
  type CompetitionLevel,
  type EventType,
  type ReviewRow,
} from "@shootermarkt/db/pdf-import-types";
import type { CommitPayload } from "@shootermarkt/db/pdf-import-types";
import { EXCEL_RESULT_HEADERS, EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME } from "./template";

type RawExcelRow = Record<string, unknown>;

const COMPETITION_LEVELS = new Set<CompetitionLevel>([
  "club", "regional", "national", "international", "continental", "world", "olympic",
]);
const EVENT_TYPES = new Set<EventType>([
  "championship", "world_cup", "champions_league", "cup", "grand_prix", "league_round", "friendly", "other",
]);
const CATEGORIES = new Set<AgeCategory>(Object.keys(CATEGORY_RANK) as AgeCategory[]);

export interface ParsedExcelImport {
  competitionId?: number;
  competition?: NonNullable<CommitPayload["competition"]> & { dateEnd?: string };
  rows: ReviewRow[];
  errors: string[];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function optionalNumber(value: unknown, label: string, rowNumber: number, errors: string[]): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    errors.push(`Red ${rowNumber}: ${label} mora biti broj.`);
    return undefined;
  }
  return parsed;
}

function optionalBoolean(value: unknown, rowNumber: number, errors: string[]): boolean | undefined {
  const raw = text(value).toLowerCase();
  if (!raw) return undefined;
  if (["da", "yes", "true", "1"].includes(raw)) return true;
  if (["ne", "no", "false", "0"].includes(raw)) return false;
  errors.push(`Red ${rowNumber}: qualified mora biti DA ili NE.`);
  return undefined;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parseExcelResultRows(rawRows: RawExcelRow[], headers: string[]): ParsedExcelImport {
  const errors: string[] = [];
  const missingHeaders = EXCEL_RESULT_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    return { rows: [], errors: [`Nedostaju kolone iz šablona: ${missingHeaders.join(", ")}.`] };
  }

  const rows: ReviewRow[] = [];
  let competitionId: number | undefined;
  let competition: ParsedExcelImport["competition"];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    if (text(rawRow.first_name) === EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME) return;

    const rowErrors: string[] = [];
    const firstName = text(rawRow.first_name);
    const lastName = text(rawRow.last_name);
    const disciplineCode = text(rawRow.discipline_code).toUpperCase();
    const qualificationTotal = optionalNumber(rawRow.qualification_total, "qualification_total", rowNumber, rowErrors);

    if (!firstName) rowErrors.push(`Red ${rowNumber}: first_name je obavezan.`);
    if (!lastName) rowErrors.push(`Red ${rowNumber}: last_name je obavezan.`);
    if (!IMPORTED_DISCIPLINE_CODES.includes(disciplineCode as ReviewRow["disciplineCode"])) {
      rowErrors.push(`Red ${rowNumber}: discipline_code mora biti jedan od ${IMPORTED_DISCIPLINE_CODES.join(", ")}.`);
    }
    if (qualificationTotal === undefined) rowErrors.push(`Red ${rowNumber}: qualification_total je obavezan.`);

    const rawCompetitionId = optionalNumber(rawRow.competition_id, "competition_id", rowNumber, rowErrors);
    const currentCompetitionId = rawCompetitionId === undefined ? undefined : Math.trunc(rawCompetitionId);
    const competitionName = text(rawRow.competition_name);
    const competitionDate = text(rawRow.competition_date);
    const competitionDateEnd = text(rawRow.competition_date_end);
    const competitionLevel = text(rawRow.competition_level) as CompetitionLevel;
    const competitionEventType = (text(rawRow.competition_event_type) || "other") as EventType;

    if (currentCompetitionId) {
      if (competitionId !== undefined && competitionId !== currentCompetitionId) {
        rowErrors.push(`Red ${rowNumber}: fajl može sadržati rezultate samo jednog takmičenja.`);
      }
    } else {
      if (!competitionName) rowErrors.push(`Red ${rowNumber}: competition_name je obavezan kada competition_id nije popunjen.`);
      if (!validDate(competitionDate)) rowErrors.push(`Red ${rowNumber}: competition_date mora biti YYYY-MM-DD.`);
      if (competitionDateEnd && !validDate(competitionDateEnd)) rowErrors.push(`Red ${rowNumber}: competition_date_end mora biti YYYY-MM-DD.`);
      if (!COMPETITION_LEVELS.has(competitionLevel)) rowErrors.push(`Red ${rowNumber}: competition_level nije važeći.`);
      if (!EVENT_TYPES.has(competitionEventType)) rowErrors.push(`Red ${rowNumber}: competition_event_type nije važeći.`);

      const currentCompetition = {
        name: competitionName,
        date: competitionDate,
        dateEnd: competitionDateEnd || undefined,
        location: text(rawRow.competition_location) || undefined,
        level: competitionLevel,
        eventType: competitionEventType,
        organizer: text(rawRow.competition_organizer) || undefined,
      };
      if (competition && JSON.stringify(competition) !== JSON.stringify(currentCompetition)) {
        rowErrors.push(`Red ${rowNumber}: podaci o takmičenju moraju biti isti u svim redovima.`);
      }
    }

    const category = (text(rawRow.result_category) || "senior") as AgeCategory;
    if (!CATEGORIES.has(category)) rowErrors.push(`Red ${rowNumber}: result_category nije važeća.`);
    const gender = text(rawRow.gender).toUpperCase();
    if (gender && gender !== "M" && gender !== "F") rowErrors.push(`Red ${rowNumber}: gender mora biti M ili F.`);

    const series = Array.from({ length: 6 }, (_, seriesIndex) =>
      optionalNumber(rawRow[`series_${seriesIndex + 1}`], `series_${seriesIndex + 1}`, rowNumber, rowErrors)
    );
    const hasSeries = series.some((value) => value !== undefined);
    const birthYear = optionalNumber(rawRow.birth_year, "birth_year", rowNumber, rowErrors);
    const qualInners = optionalNumber(rawRow.qualification_inners, "qualification_inners", rowNumber, rowErrors);
    const qualRank = optionalNumber(rawRow.qualification_rank, "qualification_rank", rowNumber, rowErrors);
    const qualified = optionalBoolean(rawRow.qualified, rowNumber, rowErrors);
    const finalTotal = optionalNumber(rawRow.final_total, "final_total", rowNumber, rowErrors);
    const finalRank = optionalNumber(rawRow.final_rank, "final_rank", rowNumber, rowErrors);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    if (currentCompetitionId) competitionId ??= currentCompetitionId;
    else {
      competition ??= {
        name: competitionName,
        date: competitionDate,
        dateEnd: competitionDateEnd || undefined,
        location: text(rawRow.competition_location) || undefined,
        level: competitionLevel,
        eventType: competitionEventType,
        organizer: text(rawRow.competition_organizer) || undefined,
      };
    }

    const code = disciplineCode as ReviewRow["disciplineCode"];
    const meta = DISCIPLINE_META[code];
    rows.push({
      firstName,
      lastName,
      teamNoc: (text(rawRow.team_noc).toUpperCase() || "SRB").slice(0, 3),
      birthYear: birthYear ?? null,
      gender: (gender || meta.gender) as "M" | "F",
      apparatus: text(rawRow.apparatus) || meta.apparatus,
      clubAbbr: text(rawRow.club_name) || undefined,
      disciplineCode: code,
      category,
      qualTotal: qualificationTotal!,
      qualInners: qualInners ?? null,
      qualRank,
      qualSeries: hasSeries ? series.map((value) => value ?? 0) : undefined,
      qualified: qualified ?? null,
      finalTotal: finalTotal ?? null,
      finalRank,
    });
  });

  if (competitionId !== undefined && competition) {
    errors.push("Koristi competition_id ili podatke za novo takmičenje, ne oba." );
  }
  if (rows.length > 0 && competitionId === undefined && !competition) {
    errors.push("Nedostaju podaci o takmičenju.");
  }

  return { competitionId, competition, rows, errors };
}
