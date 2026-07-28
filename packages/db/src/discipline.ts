import { DISCIPLINE_META, type DisciplineCode } from "./pdf-import-types";

export const REVIEW_DISCIPLINE_CODES = ["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW"] as const;
const LEGACY: Record<string, DisciplineCode> = { RFM: "R3PM", RFW: "R3PW" };
const DISTANCES: Record<string, string[]> = { ARM: ["10m"], ARW: ["10m"], APM: ["10m"], APW: ["10m"], R3PM: ["25m", "50m"], R3PW: ["25m", "50m"], SPW: ["25m"], RFPM: ["25m"], FPM: ["50m"] };

export function normalizeDisciplineCode(code: string): DisciplineCode | null {
  const value = code.trim().toUpperCase();
  return LEGACY[value] ?? (value in DISCIPLINE_META ? value as DisciplineCode : null);
}

export function distanceTagsForDisciplines(codes: string[]) {
  return [...new Set(codes.flatMap((code) => DISTANCES[code] ?? []))];
}
