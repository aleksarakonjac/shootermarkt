/** Dodatne SIUS/ISSF oznake jedne faze: tekst kazne, shoot-off ("SO", "+10", "+1+1+3"), rekord ("WR", "QWR"…). */
export type StageRemarks = { penalty?: string; shootOff?: string; record?: string };
/** Oznake po fazi; kvalifikacije/eliminacije/finale su odvojeni nastupi. */
export type RemarkDetails = { qual?: StageRemarks; elim?: StageRemarks; final?: StageRemarks };

export type DisciplineCode = "ARM" | "ARW" | "APM" | "APW" | "ARMT" | "APMT" | "R3PM" | "R3PW" | "SPW";
export const MIXED_TEAM_CODES = ["ARMT", "APMT"] as const;
export type MixedTeamCode = typeof MIXED_TEAM_CODES[number];

// Vrednosti moraju odgovarati DB enumu `age_category` (schema.ts).
export type AgeCategory =
  | "pionir" | "kadet" | "mladji_junior" | "junior"
  | "mladji_senior" | "senior" | "master" | "open";

/** Lestvica po uzrastu (mlađi → stariji). Manji rank = mlađa kategorija. */
export const CATEGORY_RANK: Record<AgeCategory, number> = {
  pionir: 0, kadet: 1, mladji_junior: 2, junior: 3,
  mladji_senior: 4, senior: 5, master: 6, open: 7,
};

export const CATEGORY_LABEL: Record<AgeCategory, string> = {
  pionir: "Pionir",
  kadet: "Kadet (U16)",
  mladji_junior: "Mlađi junior (U18)",
  junior: "Junior (U21)",
  mladji_senior: "Mlađi senior (U23)",
  senior: "Senior",
  master: "Master",
  open: "Open",
};

/** Iz naslova tabele biltena izvedi kategoriju. Proverava od najspecifičnije. */
export function parseCategory(heading: string | null | undefined): AgeCategory {
  const h = (heading ?? "").toLowerCase();
  if (/pionir/.test(h)) return "pionir";
  if (/kadet|cadet|\bu-?16\b/.test(h)) return "kadet";
  if (/mla[dđ]ji?\s*junior|younger\s*junior|\bu-?18\b/.test(h)) return "mladji_junior";
  if (/\bu-?23\b|mla[dđ]ji?\s*senior/.test(h)) return "mladji_senior";
  if (/junior|\bu-?21\b/.test(h)) return "junior";
  if (/master|veteran/.test(h)) return "master";
  return "senior";
}

/**
 * Uzrasna kategorija strelca po godini rođenja, ISSF standard (age = godina − godina rođenja).
 * Namerno bez mladji_senior/master — U23 važi samo na posebnim evropskim prvenstvima,
 * ne kao opšta kategorija; master se ne koristi. Za profil strelca (opšti prikaz, van
 * konteksta konkretnog takmičenja) ostaju samo uzrasne klase koje realno važe uvek.
 */
export function computeAgeCategoryFromBirthYear(
  birthYear: number,
  atYear: number = new Date().getFullYear()
): AgeCategory {
  const age = atYear - birthYear;
  if (age <= 13) return "pionir";
  if (age <= 15) return "kadet";
  if (age <= 17) return "mladji_junior";
  if (age <= 20) return "junior";
  return "senior";
}

export type CompetitionLevel = "club" | "regional" | "national" | "international" | "continental" | "world" | "olympic";
export type EventType = "championship" | "world_cup" | "champions_league" | "cup" | "grand_prix" | "league_round" | "friendly" | "other";

export interface ParsedShooterResult {
  /** null za DNS/DNF redove bez plasmana */
  rank: number | null;
  bibNumber?: number;
  lastName: string;
  firstName: string;
  /** Country/team IOC code (SRB, GER, KOR...) — always present */
  teamNoc: string;
  /** Actual club name or abbreviation — only in national biltens */
  clubName?: string;
  /** Birth year if present in bulletin (npr. 2004), else null */
  birthYear?: number | null;
  series: number[];
  /** null kad strelac nije pucao (DNS) */
  total: number | null;
  inners?: number | null;
  qualified?: boolean | null;
  /** ISSF/SIUS remark: RPO, DSQ, DNS, DNF, SO */
  remark?: string | null;
}

/**
 * Discipline koje sistem uvozi (MVP). Ostale se preskaču pri parsiranju.
 * apparatus + gender se izvode iz koda (za kreiranje novih strelaca — pol znamo
 * iz discipline, npr. vazdušna puška seniorke → ženско).
 */
export const DISCIPLINE_META: Record<DisciplineCode, { apparatus: string; gender: "M" | "F" | null; label: string }> = {
  ARM:  { apparatus: "air_rifle",  gender: "M",  label: "Vazdušna puška M" },
  ARW:  { apparatus: "air_rifle",  gender: "F",  label: "Vazdušna puška Ž" },
  APM:  { apparatus: "air_pistol", gender: "M",  label: "Vazdušni pištolj M" },
  APW:  { apparatus: "air_pistol", gender: "F",  label: "Vazdušni pištolj Ž" },
  ARMT: { apparatus: "air_rifle",  gender: null, label: "Vazdušna puška Mešoviti tim" },
  APMT: { apparatus: "air_pistol", gender: null, label: "Vazdušni pištolj Mešoviti tim" },
  R3PM: { apparatus: "rifle",      gender: "M",  label: "MK puška trostav M" },
  R3PW: { apparatus: "rifle",      gender: "F",  label: "MK puška trostav Ž" },
  SPW:  { apparatus: "pistol",     gender: "F",  label: "Sport pištolj Ž" },
};

/** Kodovi disciplina koje uvozimo. */
export const IMPORTED_DISCIPLINE_CODES = Object.keys(DISCIPLINE_META) as DisciplineCode[];

export function deriveFinalRankProgression(
  cumulative: readonly number[] | undefined,
  peerCumulatives: readonly (readonly number[] | undefined)[],
): Array<number | null> | null {
  if (!cumulative?.length) return null;

  return cumulative.map((score, index) => {
    const scores = peerCumulatives.flatMap((values) => {
      const value = values?.[index];
      return value == null ? [] : [value];
    });
    return scores.length > 1 ? 1 + scores.filter((value) => value > score).length : null;
  });
}

export interface ParsedFinalResult {
  rank: number;
  lastName: string;
  firstName: string;
  teamNoc: string;
  total: number;
  /** Zbirovi po seriji/fazi finala iz biltena. */
  series?: number[] | null;
  /** Nazivi serija/faza koji odgovaraju polju series. */
  seriesLabels?: string[] | null;
  /** Pojedinačni hici finala, samo ako su eksplicitno prikazani. */
  shots?: number[] | null;
  /** Kumulativni rezultat posle svakog hica/faze, kada ga bilten prikazuje. */
  cumulative?: number[] | null;
}

export interface ParsedEvent {
  discipline: DisciplineCode;
  stage: "qualification" | "final";
  /** Uzrasna kategorija tabele (iz naslova). Default senior. */
  category: AgeCategory;
  /** true when the PDF is from an international competition */
  isInternational?: boolean;
  /** Lista gostiju (van konkurencije) — SIUS "Guests" tabela */
  guest?: boolean;
  /** Zaseban meč istog takmičenja (npr. memorijal drugog dana); null = glavno takmičenje */
  eventName?: string | null;
  eventDate?: string | null;
  results: ParsedShooterResult[] | ParsedFinalResult[];
}

export interface ParsedBilten {
  events: ParsedEvent[];
  rawText?: string;
  /** SIUS parser preskočio finala (različiti formati) — traže poseban izvor. */
  hasFinals?: boolean;
}

/** One row in the admin review table, ready for commit */
export interface ReviewRow {
  shooterId?: number;        // matched DB shooter
  /** true kad nema sigurnog poklapanja u bazi — strelac će biti kreiran pri commit-u */
  isNew?: boolean;
  /** Fuzzy predlog: verovatno isti strelac (drugačiji zapis imena) — admin potvrđuje. */
  suggestedShooterId?: number;
  suggestedName?: string;
  /** ISSF ID strelca, dostupan kad se uvozi sa ISSF sajta */
  issfId?: string;
  firstName: string;
  lastName: string;
  /** Country/team IOC code — used as nationality */
  teamNoc: string;
  /** Godište rođenja iz biltena (editabilno u review-u), ako postoji */
  birthYear?: number | null;
  /** Pol izveden iz discipline (M/F) — za kreiranje novog strelca */
  gender?: "M" | "F";
  /** Apparatus izveden iz discipline — za kreiranje novog strelca */
  apparatus?: string;
  /** Actual club abbreviation, only from national biltens */
  clubAbbr?: string;
  clubId?: number;           // matched DB club

  disciplineCode: DisciplineCode;
  /** Zaseban meč istog takmičenja (competition_events); null/undefined = glavno takmičenje */
  eventName?: string | null;
  eventDate?: string | null;
  /** Uzrasna kategorija pod kojom rezultat važi (najmlađa u kojoj strelac nastupa). */
  category: AgeCategory;
  qualTotal: number | null;
  qualInners?: number | null;
  qualRank?: number;
  qualSeries?: number[];
  qualPositions?: {
    kneeling: { series: number[][]; total: number };
    prone:    { series: number[][]; total: number };
    standing: { series: number[][]; total: number };
  };
  qualified?: boolean | null;
  elimRound?: number | null;
  elimTotal?: number | null;
  elimInners?: number | null;
  elimRank?: number | null;
  elimSeries?: number[] | null;
  finalTotal?: number | null;
  finalRank?: number | null;
  finalSeries?: number[] | null;
  finalSeriesLabels?: string[] | null;
  finalShots?: number[] | null;
  finalCumulative?: number[] | null;
  finalRanks?: Array<number | null> | null;
  finalScoring?: "decimal" | "hit_count";
  /** Hici grupisani po fazi finala (ISSF scraper). */
  finalShotsByStage?: number[][] | null;
  /** Strelac je bio u shoot-off-u. */
  finalShootOff?: boolean | null;

  /** ISSF/SIUS remark: RPO, DSQ, DNS, DNF, SO */
  remark?: string | null;
  /** Remark eliminacije, odvojen od `remark` kvalifikacija. */
  elimRemark?: string | null;
  /** Remark finala (DSQ/DNS/DNF…), odvojen od `remark` kvalifikacija. */
  finalRemark?: string | null;
  /** Kazna / shoot-off / rekord po fazi (SIUS). */
  remarkDetails?: RemarkDetails;

  /** UI controls */
  skip?: boolean;
  warning?: string;
}

/**
 * Dedup unutar iste liste: isti strelac+disciplina+kategorija+rezultat dva puta = isti red.
 * Seniorska i juniorska lista istog meča se NAMERNO čuvaju obe (prikaz obe rang liste);
 * forma isti skor istog dana broji jednom (`dedupeSameMatch` u forma.ts).
 */
export function dedupeRowsByCategory(rows: ReviewRow[], foldName: (s: string) => string): ReviewRow[] {
  const seen = new Map<string, ReviewRow>();
  for (const r of rows) {
    const key = `${foldName(r.lastName)}|${foldName(r.firstName)}|${r.teamNoc}|${r.eventName ?? ""}|${r.disciplineCode}|${r.category}|${r.qualTotal}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  return [...seen.values()];
}

/**
 * Finale je isti nastup kao kvalifikacija: čuva se na istom rezultatu, ali u
 * odvojenim finalTotal/finalRank poljima. Kategorija finala ume da se razlikuje
 * od kvalifikacione tabele, zato se prvo pokušava precizno poklapanje, a zatim
 * isti strelac i disciplina.
 */
export function mergeFinalsIntoRows(
  rows: ReviewRow[],
  events: ParsedEvent[],
  foldName: (name: string) => string,
): { rows: ReviewRow[]; matchedFinals: number; unmatchedFinals: number } {
  const finalEvents = events.filter((event) => event.stage === "final");
  let matchedFinals = 0;
  let unmatchedFinals = 0;

  for (const event of finalEvents) {
    for (const rawResult of event.results as ParsedFinalResult[]) {
      const teamNoc = rawResult.teamNoc.toUpperCase();
      const candidates = rows.filter((row) => (
        row.disciplineCode === event.discipline
        && (row.eventName ?? null) === (event.eventName ?? null)
        && row.teamNoc.toUpperCase() === teamNoc
        && foldName(row.firstName) === foldName(rawResult.firstName)
        && foldName(row.lastName) === foldName(rawResult.lastName)
      ));
      const row = candidates.find((candidate) => candidate.category === event.category)
        ?? candidates.find((candidate) => candidate.qualified)
        ?? candidates[0];

      if (!row) {
        unmatchedFinals++;
        continue;
      }

      row.finalTotal = rawResult.total;
      row.finalRank = rawResult.rank;
      row.finalSeries = rawResult.series ?? null;
      row.finalSeriesLabels = rawResult.seriesLabels ?? null;
      row.finalShots = rawResult.shots ?? null;
      row.finalCumulative = rawResult.cumulative ?? null;
      row.finalRanks = deriveFinalRankProgression(
        rawResult.cumulative ?? undefined,
        (event.results as ParsedFinalResult[]).map((result) => result.cumulative ?? undefined),
      );
      row.finalScoring = event.discipline === "SPW" ? "hit_count" : "decimal";
      row.qualified = true;
      matchedFinals++;
    }
  }

  return { rows, matchedFinals, unmatchedFinals };
}

export interface CommitPayload {
  /** Excel i ručni unos su administrativni unosi; PDF/ISSF tokovi čuvaju svoj izvor. */
  source?: "manual" | "pdf_import" | "issf_import" | "esc_import" | "sius_import";
  tags?: string[];
  competitionId?: number; // if set, skip upsert and use existing (competition može izostati)
  competition?: {
    name: string;
    date: string; // YYYY-MM-DD
    dateEnd?: string;
    location?: string;
    level: CompetitionLevel;
    eventType?: EventType;
    organizer?: string;
    tags?: string[];
  };
  rows: ReviewRow[];
}
