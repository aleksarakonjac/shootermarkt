export type DisciplineCode = "ARM" | "ARW" | "APM" | "APW";
export type CompetitionLevel = "drzavno" | "kup" | "regionalno" | "medjunarodno";

export interface ParsedShooterResult {
  rank: number;
  bibNumber?: number;
  lastName: string;
  firstName: string;
  clubNoc?: string;
  series: number[];
  total: number;
  inners?: number | null;
  qualified?: boolean | null;
}

export interface ParsedFinalResult {
  rank: number;
  lastName: string;
  firstName: string;
  clubNoc?: string;
  total: number;
}

export interface ParsedEvent {
  discipline: DisciplineCode;
  stage: "qualification" | "final";
  results: ParsedShooterResult[] | ParsedFinalResult[];
}

export interface ParsedBilten {
  events: ParsedEvent[];
  rawText?: string;
}

/** After admin review, ready for commit */
export interface ReviewRow {
  /** Matched or to-be-created shooter */
  shooterId?: number;
  firstName: string;
  lastName: string;
  clubNoc?: string;
  clubId?: number;

  disciplineCode: DisciplineCode;
  qualTotal: number;
  qualInners?: number | null;
  qualRank?: number;
  qualSeries?: number[];
  qualified?: boolean | null;
  finalTotal?: number | null;
  finalRank?: number | null;

  /** UI state */
  skip?: boolean;
  warning?: string;
}

export interface CommitPayload {
  competition: {
    name: string;
    date: string; // YYYY-MM-DD
    location?: string;
    level: CompetitionLevel;
  };
  rows: ReviewRow[];
}
