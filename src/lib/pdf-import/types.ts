export type DisciplineCode = "ARM" | "ARW" | "APM" | "APW";
export type CompetitionLevel = "drzavno" | "kup" | "regionalno" | "medjunarodno";

export interface ParsedShooterResult {
  rank: number;
  bibNumber?: number;
  lastName: string;
  firstName: string;
  /** Country/team IOC code (SRB, GER, KOR...) — always present */
  teamNoc: string;
  /** Actual club name or abbreviation — only in national biltens */
  clubName?: string;
  series: number[];
  total: number;
  inners?: number | null;
  qualified?: boolean | null;
}

export interface ParsedFinalResult {
  rank: number;
  lastName: string;
  firstName: string;
  teamNoc: string;
  total: number;
}

export interface ParsedEvent {
  discipline: DisciplineCode;
  stage: "qualification" | "final";
  /** true when the PDF is from an international competition */
  isInternational?: boolean;
  results: ParsedShooterResult[] | ParsedFinalResult[];
}

export interface ParsedBilten {
  events: ParsedEvent[];
  rawText?: string;
}

/** One row in the admin review table, ready for commit */
export interface ReviewRow {
  shooterId?: number;        // matched DB shooter
  firstName: string;
  lastName: string;
  /** Country/team IOC code — used as nationality */
  teamNoc: string;
  /** Actual club abbreviation, only from national biltens */
  clubAbbr?: string;
  clubId?: number;           // matched DB club

  disciplineCode: DisciplineCode;
  qualTotal: number;
  qualInners?: number | null;
  qualRank?: number;
  qualSeries?: number[];
  qualified?: boolean | null;
  finalTotal?: number | null;
  finalRank?: number | null;

  /** UI controls */
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
