const ISSF_API = "https://api.issf-sports.org/api/v01";
const ISSF_WEB = "https://www.issf-sports.org";

export type DisciplineCode = "ARM" | "ARW" | "APM" | "APW" | "R3PM" | "R3PW";
export type MixedTeamDisciplineCode = "APMT" | "ARMT";

const ISSF_EVENT_MAP: Record<string, DisciplineCode> = {
  ARM:  "ARM",
  ARW:  "ARW",
  APM:  "APM",
  APW:  "APW",
  R3PM: "R3PM",
  R3PW: "R3PW",
};

// ISSF may use various codes for mixed team events
const ISSF_MIXED_TEAM_MAP: Record<string, MixedTeamDisciplineCode> = {
  APMT: "APMT",
  ARMT: "ARMT",
  // Some ISSF events use longer codes
  "10MAPM": "APMT",
  "10MARM": "ARMT",
};

export interface ISSFCompetitionType {
  id: number;
  name: string;
  acronym: string;
}

export interface ISSFCompetition {
  id: number;
  name: string;
  dateFrom: string;
  dateTo: string;
  city: string;
  nationCode: string;
  nationName: string;
  competitionType?: ISSFCompetitionType;
  disciplines?: Array<{ id: number; name: string }>;
}

export interface ISSFResultPhase {
  title: string;
  startDateTime: string;
  resultKey: string;
  pdfResultLink: string | null;
}

export interface ISSFResultEvent {
  eventCode: string;
  isJunior: boolean;
  title: string;
  competitionResultPhases: ISSFResultPhase[];
}

export interface ISSFResultGroup {
  name: string;
  competitionResultEvents: ISSFResultEvent[];
}

export interface ISSFAthlete {
  issfId: string;
  firstName: string;
  familyName: string;
  nationCode: string;
  gender: string;
  birthday: string;
  portraitUrl?: string;
  events?: string;
  achievements: ISSFAchievement[];
}

const RIFLE_PREFIXES   = ["AR", "R3"];
const PISTOL_PREFIXES  = ["AP", "FP", "SP", "CFP", "STP", "RFP"];
const SHOTGUN_PREFIXES = ["TR", "SK", "DT", "FT"];

export function inferApparatus(events: string | undefined | null): "rifle" | "pistol" | "both" | "shotgun" | null {
  if (!events?.trim()) return null;
  const codes = events.split(",").map((e) => e.trim().toUpperCase());
  const isRifle   = codes.some((c) => RIFLE_PREFIXES.some((p)   => c === p || c.startsWith(p)));
  const isPistol  = codes.some((c) => PISTOL_PREFIXES.some((p)  => c === p || c.startsWith(p)));
  const isShotgun = codes.some((c) => SHOTGUN_PREFIXES.some((p) => c === p || c.startsWith(p)));
  if (isRifle && isPistol) return "both";
  if (isRifle)   return "rifle";
  if (isPistol)  return "pistol";
  if (isShotgun) return "shotgun";
  return null;
}

/** Fetch full athlete profile (includes events + full birthday). */
export async function fetchAthleteProfile(issfId: string, signal?: AbortSignal): Promise<Partial<ISSFAthlete>> {
  try {
    const res = await fetch(`${ISSF_API}/athletes/${issfId}`, { next: { revalidate: 86400 }, signal });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export interface ISSFAchievement {
  rank: number;
  eventTitle: string;
  competitionCity: string;
  competitionYear: number;
  competitionTypeName: string;
  competitionTypeNameShort: string;
  scores: Array<{ name: string; score: string }>;
}

/** Fetch list of competitions for a year. */
export async function fetchCompetitions(year: number): Promise<ISSFCompetition[]> {
  const res = await fetch(`${ISSF_API}/competitions?year=${year}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ISSF competitions fetch failed: ${res.status}`);
  return res.json();
}

/** Fetch competition detail including result groups/events. */
export async function fetchCompetitionResults(
  competitionId: number
): Promise<ISSFResultGroup[]> {
  const res = await fetch(`${ISSF_API}/competitions/${competitionId}/results`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ISSF results fetch failed: ${res.status}`);
  return res.json();
}

/** Extract MVP discipline events (ARM/ARW/APM/APW) from result groups, senior + junior. */
export function extractMvpEvents(
  groups: ISSFResultGroup[]
): Array<{
  disciplineCode: DisciplineCode;
  category: "senior" | "junior";
  qualPhase: ISSFResultPhase | null;
  finalPhase: ISSFResultPhase | null;
  elimPhases: Array<{ round: number; phase: ISSFResultPhase }>;
}> {
  const out = [];
  for (const group of groups) {
    for (const event of group.competitionResultEvents) {
      const dc = ISSF_EVENT_MAP[event.eventCode];
      if (!dc) continue;

      const phases = event.competitionResultPhases;
      const qualPhase =
        phases.find((p) => /^qualification$/i.test(p.title)) ??
        phases.find((p) => /qual/i.test(p.title) && !/final/i.test(p.title)) ??
        null;
      const finalPhase =
        phases.find((p) => /^finals?$/i.test(p.title)) ??
        phases.find((p) => /final/i.test(p.title)) ??
        null;

      // Relay phases for R3P: "Elimination Relay N", "Qualification Relay N", "Relay N"
      const rawElim = phases.filter(
        (p) => /elimination|relay/i.test(p.title) && !/^finals?$/i.test(p.title)
      );
      const elimPhases = rawElim.map((p, i) => {
        const m = p.title.match(/(\d+)\s*$/);
        return { round: m ? parseInt(m[1]) : i + 1, phase: p };
      });

      out.push({ disciplineCode: dc, category: event.isJunior ? "junior" as const : "senior" as const, qualPhase, finalPhase, elimPhases });
    }
  }
  return out;
}

/**
 * Fetch R3P elimination round results — same HTML format as qualification.
 * Integer totals (no decimals for 50m 3P elimination), with Q marker for advancers.
 */
export async function fetchElimResultsFromHtml(
  competitionId: number,
  resultKey: string,
  noCache = false
): Promise<ISSFQualResult[]> {
  return fetchQualResultsFromHtml(competitionId, resultKey, noCache);
}

const API_LIMIT = 300;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PREFIX_CONCURRENCY = 8;

async function searchRaw(query: string, signal?: AbortSignal): Promise<ISSFAthlete[]> {
  const res = await fetch(
    `${ISSF_API}/athletes?search=${encodeURIComponent(query)}`,
    { cache: "no-store", signal }
  );
  if (!res.ok) throw new Error(`ISSF athlete search failed: ${res.status}`);
  return res.json();
}

/**
 * Search athletes by NOC. Uses 2-char prefix pagination to bypass the 300-result API cap.
 * Single-char suffixes ("SWE M") are treated as stop-words and return 0.
 * 2-char suffixes ("SWE Ma") work and keep each page well under 300.
 * Falls back to 3-char if any 2-char prefix still hits 300 (edge case for huge nations).
 */
export async function searchAthletes(noc: string, prefix = "", depth = 0, signal?: AbortSignal): Promise<ISSFAthlete[]> {
  const query = prefix ? `${noc} ${prefix}` : noc;
  const batch = await searchRaw(query, signal);

  // If under limit, or we've hit 3-char depth, return what we have
  if (batch.length < API_LIMIT || depth >= 2) return batch;

  // Hit limit — fan out with next char. Start 2-char on depth 0, 3-char on depth 1.
  // Depth 0 (root): noc → expand to noc+2char (Aa..Zz)
  // Depth 1: noc+2char → expand to noc+3char
  const seen = new Set<string>();
  const all: ISSFAthlete[] = [];

  // At depth 0 we need to jump straight to 2-char prefixes (single chars are stop-words)
  const nextPrefixes = depth === 0
    ? Array.from(LETTERS).flatMap((a) => Array.from(LETTERS).map((b) => `${a}${b}`))
    : Array.from(LETTERS).map((l) => `${prefix}${l}`);

  for (let i = 0; i < nextPrefixes.length; i += PREFIX_CONCURRENCY) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const batches = await Promise.all(nextPrefixes.slice(i, i + PREFIX_CONCURRENCY).map((p) => searchAthletes(noc, p, depth + 1, signal)));
    for (const batch of batches) {
      for (const a of batch) {
        if (!seen.has(a.issfId)) {
          seen.add(a.issfId);
          all.push(a);
        }
      }
    }
  }

  return all;
}

/** Fetch full athlete profile including achievements. */
export async function fetchAthlete(issfId: string): Promise<ISSFAthlete> {
  const res = await fetch(`${ISSF_API}/athletes/${issfId}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ISSF athlete fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Map ISSF eventTitle to our discipline code.
 * eventTitle examples: "10m Air Rifle Men", "10m Air Pistol Women Junior"
 */
export function mapEventTitleToDiscipline(eventTitle: string): DisciplineCode | null {
  const t = eventTitle.toLowerCase();
  if (t.includes("air rifle") && t.includes("men") && !t.includes("women")) return "ARM";
  if (t.includes("air rifle") && t.includes("women")) return "ARW";
  if (t.includes("air pistol") && t.includes("men") && !t.includes("women")) return "APM";
  if (t.includes("air pistol") && t.includes("women")) return "APW";
  return null;
}

// ── Schedule Scraper ──────────────────────────────────────────────────────────

export interface ISSFScheduleEntry {
  date: string;         // "2026-07-22"
  dayLabel: string;     // "Wednesday - 22 JUL"
  startTime: string;    // "09:15" or "" if no time listed
  endTime: string | null;
  eventTitle: string;
  disciplineCode: string | null; // null = not a shooting event we track
  stage: "qual" | "elimination" | "final" | "training" | "ceremony" | "other";
  isTraining: boolean;
  isFinal: boolean;
  isMedal: boolean;
  relay: number | null;
}

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const EVENT_DISCIPLINE_MAP: Array<[RegExp, string]> = [
  [/10m air pistol mixed team/i, "APMT"],
  [/10m air rifle mixed team/i,  "ARMT"],
  [/10m air rifle men/i,          "ARM"],
  [/10m air rifle women/i,        "ARW"],
  [/10m air pistol men/i,         "APM"],
  [/10m air pistol women/i,       "APW"],
  [/50m rifle 3.positions? men/i, "R3PM"],
  [/50m rifle 3.positions? women/i,"R3PW"],
  [/25m rapid fire pistol/i,      "RFPM"],
  [/25m (?:sport )?pistol women/i,"SPW"],
  [/50m free pistol/i,            "FPM"],
];

function mapTitleToDisciplineCode(title: string): string | null {
  // Strip leading event type prefixes before matching
  const clean = title
    .replace(/^final\s+/i, "")
    .replace(/^pre-event training\s+/i, "")
    .replace(/^medal ceremony\s*/i, "")
    .replace(/\s+relay\s+\d+/i, "")
    .replace(/\s+elimination(?:\s+relay\s+\d+)?/i, "")
    .trim();
  for (const [re, code] of EVENT_DISCIPLINE_MAP) {
    if (re.test(clean)) return code;
  }
  return null;
}

function detectStage(title: string): ISSFScheduleEntry["stage"] {
  if (/^pre-event training/i.test(title)) return "training";
  if (/^medal ceremony/i.test(title))     return "ceremony";
  if (/^final\s/i.test(title))            return "final";
  if (/elimination/i.test(title))         return "elimination";
  if (/qual/i.test(title))                return "qual";
  return "qual"; // default for competition entries with a time
}

function detectRelay(title: string): number | null {
  const m = title.match(/relay\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function parseScheduleHtml(html: string, year: number): ISSFScheduleEntry[] {
  const entries: ISSFScheduleEntry[] = [];

  // Find all h3 day headers and their positions
  const dayHeaderRe = /<h3[^>]*class="[^"]*font-bold[^"]*"[^>]*>([^<]+)<\/h3>/g;
  const dayHeaders: Array<{ label: string; index: number; matchLen: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = dayHeaderRe.exec(html)) !== null) {
    dayHeaders.push({ label: m[1].trim(), index: m.index, matchLen: m[0].length });
  }

  for (let i = 0; i < dayHeaders.length; i++) {
    const header = dayHeaders[i];
    const nextIndex = i + 1 < dayHeaders.length ? dayHeaders[i + 1].index : html.length;
    const dayHtml = html.slice(header.index + header.matchLen, nextIndex);

    // Parse date: "Monday - 20 JUL" or "MONDAY - 20 JUL"
    const dateMatch = header.label.match(/(\d{1,2})\s+([A-Z]{3})/i);
    if (!dateMatch) continue;
    const day = parseInt(dateMatch[1]);
    const month = MONTH_MAP[dateMatch[2].toUpperCase()];
    if (!month) continue;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Find time+event entry pairs within the day block
    const entryRe = /<div[^>]*class="md:w-1\/3"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="md:w-2\/3"[^>]*>([\s\S]*?)<\/div>/g;
    while ((m = entryRe.exec(dayHtml)) !== null) {
      const timeHtml = m[1];
      const eventHtml = m[2];

      const timeSpans = [...timeHtml.matchAll(/<span>(\d{2}:\d{2})<\/span>/g)].map((s) => s[1]);
      const startTime = timeSpans[0] ?? "";
      const endTime = timeSpans[1] ?? null;

      const titleMatch = eventHtml.match(/<p[^>]*>([^<]+)<\/p>/);
      if (!titleMatch) continue;
      const eventTitle = titleMatch[1].trim();
      if (!eventTitle) continue;

      const isTraining = /^pre-event training/i.test(eventTitle);
      const isFinal   = /^final\s/i.test(eventTitle);
      const isMedal   = /^medal ceremony/i.test(eventTitle);

      entries.push({
        date: dateStr,
        dayLabel: header.label,
        startTime,
        endTime,
        eventTitle,
        disciplineCode: mapTitleToDisciplineCode(eventTitle),
        stage: detectStage(eventTitle),
        isTraining,
        isFinal,
        isMedal,
        relay: detectRelay(eventTitle),
      });
    }
  }

  return entries;
}

/** Fetch and parse the schedule for a given ISSF competition. */
export async function fetchScheduleFromHtml(
  competitionId: number,
  year: number
): Promise<ISSFScheduleEntry[]> {
  const url = `${ISSF_WEB}/competitions/${competitionId}/schedule`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`ISSF schedule fetch failed: ${res.status} ${url}`);
  const html = await res.text();
  return parseScheduleHtml(html, year);
}

export interface ISSFQualResult {
  rank: number;
  issfId: string;
  lastName: string;
  firstName: string;
  nationCode: string;
  series: number[];
  total: number;
  inners: number | null;
  qualified: boolean;
  /** RPO, DSQ, DNS, DNF, SO — null when no remark */
  remark: string | null;
}

/**
 * Scrape the ISSF results HTML page for qualification individual results.
 * No Gemini API needed — data is in a plain HTML table.
 *
 * Table row format (qualification):
 *   rank | bib | LASTNAME Firstname (link) | NOC | s1..s6 | total | Q?
 *
 * For Air Pistol, total is integer and inners come from "NNNx" style total cell
 * (e.g. "594-35x"). For Air Rifle, total is decimal (636.3).
 */
export async function fetchQualResultsFromHtml(
  competitionId: number,
  resultKey: string,
  noCache = false
): Promise<ISSFQualResult[]> {
  const url = `${ISSF_WEB}/competitions/${competitionId}/results/${resultKey}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    ...(noCache ? { cache: "no-store" as const } : { next: { revalidate: 3600 } }),
  });
  if (!res.ok) throw new Error(`ISSF HTML fetch failed: ${res.status} ${url}`);
  const html = await res.text();

  const results: ISSFQualResult[] = [];

  // Match each result row: starts with a rank td, has athlete link, NOC, series, total
  const rowRe =
    /<tr>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>\d+<\/td>\s*<td[^>]*><a href="\/athletes\/([^"]+)">([^<]+)<\/a><\/td>\s*<td[^>]*>([A-Z]{3})<\/td>((?:\s*<td[^>]*>[^<]*<\/td>)+)\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const rank = parseInt(m[1]);
    const issfId = m[2].trim();
    const rawName = m[3].replace(/&nbsp;/gi, " ").replace(/ /g, " ").trim(); // literal "&nbsp;" or real NBSP → space
    const spaceIdx = rawName.indexOf(" ");
    const lastName = spaceIdx > 0 ? rawName.slice(0, spaceIdx) : rawName;
    const firstName = spaceIdx > 0 ? rawName.slice(spaceIdx + 1) : "";
    const nationCode = m[4];
    const seriesCells = m[5];
    const totalCell = m[6].trim();
    const remarkRaw = m[7].trim();
    const qualified = remarkRaw === "Q";
    const remark = (remarkRaw && remarkRaw !== "Q") ? remarkRaw : null;

    // Extract series values from cells
    const seriesRe = /<td[^>]*>([\d.]+)<\/td>/g;
    const series: number[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = seriesRe.exec(seriesCells)) !== null) {
      series.push(parseFloat(sm[1]));
    }

    // Parse total — may be "594-35x" (AP) or "636.3" (AR)
    let total: number;
    let inners: number | null = null;
    const innersMatch = totalCell.match(/^(\d+)-(\d+)x$/);
    if (innersMatch) {
      total = parseInt(innersMatch[1]);
      inners = parseInt(innersMatch[2]);
    } else {
      total = parseFloat(totalCell);
    }

    if (isNaN(total)) continue;

    results.push({ rank, issfId, lastName, firstName, nationCode, series, total, inners, qualified, remark });
  }

  return results;
}

export interface ISSFThreePResult {
  rank: number;
  issfId: string;
  lastName: string;
  firstName: string;
  nationCode: string;
  kneeling: { series: number[][]; total: number };
  prone:    { series: number[][]; total: number };
  standing: { series: number[][]; total: number };
  total: number;
  inners: number | null;
  qualified: boolean;
  remark: string | null;
}

function extractCells(trHtml: string): string[] {
  const cells: string[] = [];
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(trHtml)) !== null) {
    cells.push(m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim());
  }
  return cells;
}

/**
 * Scrape 50m 3-Position results HTML (qualification relay or elimination relay).
 * Each athlete spans 3 consecutive rows: Kneeling / Prone / Standing.
 * The athlete link (with ISSF ID + name) appears only in the Kneeling row.
 * Total + inners appear in the Standing row as "590 - 31x".
 */
export async function fetchR3PResultsFromHtml(
  competitionId: number,
  resultKey: string,
  noCache = false
): Promise<ISSFThreePResult[]> {
  const url = `${ISSF_WEB}/competitions/${competitionId}/results/${resultKey}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    ...(noCache ? { cache: "no-store" as const } : { next: { revalidate: 3600 } }),
  });
  if (!res.ok) throw new Error(`ISSF HTML fetch failed: ${res.status} ${url}`);
  const html = await res.text();

  const results: ISSFThreePResult[] = [];

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const trs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) trs.push(m[1]);

  for (let i = 0; i < trs.length; i++) {
    const tr = trs[i];
    const athleteMatch = tr.match(/<a\s+href="\/athletes\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!athleteMatch) continue;

    const issfId   = athleteMatch[1].trim();
    const rawName  = athleteMatch[2].replace(/&nbsp;/gi, " ").replace(/ /g, " ").replace(/<[^>]+>/g, "").trim();
    const spaceIdx = rawName.indexOf(" ");
    const lastName  = spaceIdx > 0 ? rawName.slice(0, spaceIdx) : rawName;
    const firstName = spaceIdx > 0 ? rawName.slice(spaceIdx + 1) : "";

    const knCells = extractCells(tr);
    const rank       = parseInt(knCells[0]) || 0;
    const nationCode = knCells[3] ?? "";
    const knS1       = parseFloat(knCells[5]) || 0;
    const knS2       = parseFloat(knCells[6]) || 0;
    const knTotal    = parseFloat(knCells[7]) || 0;

    const prCells = extractCells(trs[i + 1] ?? "");
    const prS1    = parseFloat(prCells[5]) || 0;
    const prS2    = parseFloat(prCells[6]) || 0;
    const prTotal = parseFloat(prCells[7]) || 0;

    const stCells   = extractCells(trs[i + 2] ?? "");
    const stS1      = parseFloat(stCells[5]) || 0;
    const stS2      = parseFloat(stCells[6]) || 0;
    const stTotal   = parseFloat(stCells[7]) || 0;
    const totalRaw  = stCells[8] ?? "";

    const totalMatch = totalRaw.match(/(\d+)\s*[-–]\s*(\d+)x/i);
    const total  = totalMatch ? parseInt(totalMatch[1]) : (knTotal + prTotal + stTotal);
    const inners = totalMatch ? parseInt(totalMatch[2]) : null;

    // Q marker may be in index 9 or 10 of the standing row
    const qCandidates = [stCells[9] ?? "", stCells[10] ?? ""];
    const qualified = qCandidates.some((s) => /^Q/.test(s.trim()));
    const remark    = qCandidates.find((s) => s.trim() && !/^Q$/.test(s.trim()) && s.trim() !== "") ?? null;

    results.push({
      rank,
      issfId,
      lastName,
      firstName,
      nationCode,
      kneeling: { series: [[knS1, knS2]], total: knTotal },
      prone:    { series: [[prS1, prS2]], total: prTotal },
      standing: { series: [[stS1, stS2]], total: stTotal },
      total,
      inners,
      qualified,
      remark: remark || null,
    });
  }

  return results;
}

export interface ISSFFinalResult {
  rank: number;
  issfId: string;
  lastName: string;
  firstName: string;
  nationCode: string;
  /** Kumulativni skor posle svake faze finala. */
  stageCumulatives: number[];
  /** Ukupan skor finala (= poslednji kumulativ). */
  total: number;
  /** Individualni hici grupisani po fazi: shotsByStage[i] = hici u fazi i. */
  shotsByStage: number[][];
  /** true ako je strelac bio u shoot-off-u (SO u Remarks koloni). */
  shootOff: boolean;
}

/**
 * Scrape ISSF final results HTML.
 *
 * Main rows: rank | bib | name link | noc | bold cumulative per stage | bold total | remarks | targets
 * Sub-rows: colspan=4 (empty) | shot per stage column (multiple sub-rows stacked vertically per stage)
 *
 * Eliminated finalists have shorter cumulative arrays (they stop at elimination round).
 * Shoot-offs detected via "SO" in Remarks td.
 */
export async function fetchFinalResultsFromHtml(
  competitionId: number,
  resultKey: string
): Promise<ISSFFinalResult[]> {
  const url = `${ISSF_WEB}/competitions/${competitionId}/results/${resultKey}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ISSF final HTML fetch failed: ${res.status} ${url}`);
  const html = await res.text();

  // ── Pass 1: locate all main rows ─────────────────────────────────────────────

  interface RawEntry {
    rank: number;
    issfId: string;
    lastName: string;
    firstName: string;
    nationCode: string;
    stageCumulatives: number[];
    total: number;
    shootOff: boolean;
    endOffset: number;
  }

  const mainRowRe =
    /<tr>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>\d+<\/td>\s*<td[^>]*><a href="\/athletes\/([^"]+)">([^<]+)<\/a><\/td>\s*<td[^>]*>([A-Z]{3})<\/td>([\s\S]*?)<\/tr>/g;

  const rawEntries: RawEntry[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = mainRowRe.exec(html)) !== null) {
    const rank = parseInt(mm[1]);
    const issfId = mm[2].trim();
    const rawName = mm[3].replace(/&nbsp;/gi, " ").replace(/\u00a0/g, " ").trim();
    const spaceIdx = rawName.indexOf(" ");
    const lastName = spaceIdx > 0 ? rawName.slice(0, spaceIdx) : rawName;
    const firstName = spaceIdx > 0 ? rawName.slice(spaceIdx + 1) : "";
    const nationCode = mm[4];
    const rest = mm[5];

    const boldRe = /<td[^>]*class="bold black"[^>]*>([\d.]+)<\/td>/g;
    const allVals: number[] = [];
    let bm: RegExpExecArray | null;
    while ((bm = boldRe.exec(rest)) !== null) {
      const v = parseFloat(bm[1]);
      if (!isNaN(v)) allVals.push(v);
    }
    if (allVals.length < 2) continue;

    const total = allVals[allVals.length - 1];
    const stageCumulatives = allVals.slice(0, -1);

    const shootOff = />\s*SO\s*</.test(rest);

    rawEntries.push({
      rank, issfId, lastName, firstName, nationCode,
      stageCumulatives, total, shootOff,
      endOffset: mm.index + mm[0].length,
    });
  }

  // ── Pass 2: parse sub-rows between consecutive main rows ──────────────────────

  const results: ISSFFinalResult[] = [];
  const subRowRe = /<tr>\s*<td[^>]*colspan[^>]*>[\s\S]*?<\/td>([\s\S]*?)<\/tr>/g;

  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    const blockStart = entry.endOffset;
    const blockEnd = i + 1 < rawEntries.length ? rawEntries[i + 1].endOffset : html.length;
    const block = html.slice(blockStart, blockEnd);

    const stageCount = entry.stageCumulatives.length;
    const shotCols: number[][] = Array.from({ length: stageCount }, () => []);

    subRowRe.lastIndex = 0;
    let sm: RegExpExecArray | null;
    while ((sm = subRowRe.exec(block)) !== null) {
      const shotPart = sm[1];
      const tdRe = /<td[^>]*>([\d.]*)<\/td>/g;
      let col = 0;
      let tm: RegExpExecArray | null;
      while ((tm = tdRe.exec(shotPart)) !== null) {
        const val = tm[1].trim();
        if (val && col < stageCount) {
          const n = parseFloat(val);
          if (!isNaN(n)) shotCols[col].push(n);
        }
        col++;
      }
    }

    results.push({
      rank: entry.rank,
      issfId: entry.issfId,
      lastName: entry.lastName,
      firstName: entry.firstName,
      nationCode: entry.nationCode,
      stageCumulatives: entry.stageCumulatives,
      total: entry.total,
      shotsByStage: shotCols,
      shootOff: entry.shootOff,
    });
  }

  return results;
}

// ── Mixed Team (APMT / ARMT) ─────────────────────────────────────────────────

export function extractMixedTeamEvents(
  groups: ISSFResultGroup[]
): Array<{
  disciplineCode: MixedTeamDisciplineCode;
  qualPhase: ISSFResultPhase | null;
  finalPhase: ISSFResultPhase | null;
}> {
  const out = [];
  for (const group of groups) {
    for (const event of group.competitionResultEvents) {
      let dc: MixedTeamDisciplineCode | null = ISSF_MIXED_TEAM_MAP[event.eventCode] ?? null;
      if (!dc) {
        const t = event.title.toLowerCase();
        if (t.includes("air pistol") && t.includes("mixed")) dc = "APMT";
        else if (t.includes("air rifle") && t.includes("mixed")) dc = "ARMT";
      }
      if (!dc) continue;

      const phases = event.competitionResultPhases;
      const qualPhase  = phases.find((p) => /qual/i.test(p.title)) ?? null;
      const finalPhase = phases.find((p) => /final/i.test(p.title)) ?? null;

      out.push({ disciplineCode: dc, qualPhase, finalPhase });
    }
  }
  return out;
}

export interface ISSFMixedTeamQualEntry {
  rank: number;
  nocCode: string;
  mIssfId: string | null;
  mLastName: string;
  mFirstName: string;
  mSeries: number[];
  mTotal: number;
  fIssfId: string | null;
  fLastName: string;
  fFirstName: string;
  fSeries: number[];
  fTotal: number;
  total: number;
  inners: number | null;
  qualified: boolean;
}

export interface ISSFMixedTeamFinalEntry {
  rank: number;
  nocCode: string;
  mIssfId: string | null;
  mLastName: string;
  mFirstName: string;
  fIssfId: string | null;
  fLastName: string;
  fFirstName: string;
  stageCumulatives: number[];
  total: number;
  shootOff: boolean;
}

function parseAthleteLink(html: string): { issfId: string; lastName: string; firstName: string } | null {
  const m = html.match(/<a\s+href="\/athletes\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!m) return null;
  const issfId  = m[1].trim();
  const rawName = m[2].replace(/&nbsp;/gi, " ").replace(/ /g, " ").replace(/<[^>]+>/g, "").trim();
  const sp = rawName.indexOf(" ");
  return {
    issfId,
    lastName:  sp > 0 ? rawName.slice(0, sp) : rawName,
    firstName: sp > 0 ? rawName.slice(sp + 1) : "",
  };
}

/**
 * Scrape ISSF mixed team qualification results.
 *
 * Format: 3-row groups per team:
 *   Row 0 — team row:   rank | bib | NOC | total | Q  (no athlete link)
 *   Row 1 — male:       (empty) | <a>Athlete</a> | NOC | series... | total
 *   Row 2 — female:     (empty) | <a>Athlete</a> | NOC | series... | total
 */
export async function fetchMixedTeamQualFromHtml(
  competitionId: number,
  resultKey: string,
  noCache = false
): Promise<ISSFMixedTeamQualEntry[]> {
  const url = `${ISSF_WEB}/competitions/${competitionId}/results/${resultKey}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    ...(noCache ? { cache: "no-store" as const } : { next: { revalidate: 3600 } }),
  });
  if (!res.ok) throw new Error(`ISSF mixed team qual fetch failed: ${res.status} ${url}`);
  const html = await res.text();

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const trs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) trs.push(m[1]);

  const results: ISSFMixedTeamQualEntry[] = [];

  for (let i = 0; i < trs.length; i++) {
    const tr = trs[i];
    if (/<a\s+href="\/athletes\//i.test(tr)) continue; // skip athlete rows
    const cells = extractCells(tr);
    const rank = parseInt(cells[0]);
    if (isNaN(rank) || rank <= 0) continue;

    const nocIdx = cells.findIndex((c) => /^[A-Z]{3}$/.test(c));
    if (nocIdx < 0) continue;
    const nocCode = cells[nocIdx];

    const numericCells = cells.slice(nocIdx + 1).filter((c) => /^\d/.test(c));
    const totalRaw = numericCells[numericCells.length - 1] ?? "";
    const lastTotalMatch = totalRaw.match(/^(\d+)\s*(?:-\s*(\d+)x\s*)?$/);
    const total  = lastTotalMatch ? parseInt(lastTotalMatch[1]) : NaN;
    const inners = lastTotalMatch?.[2] ? parseInt(lastTotalMatch[2]) : null;
    if (isNaN(total)) continue;

    const remarkCells = cells.slice(nocIdx + 1);
    const qualified = remarkCells.some((c) => /^Q/.test(c.trim()));

    let mInfo: { issfId: string; lastName: string; firstName: string } | null = null;
    let mSeries: number[] = [], mTotal = 0;
    let fInfo: { issfId: string; lastName: string; firstName: string } | null = null;
    let fSeries: number[] = [], fTotal = 0;

    for (let j = i + 1; j <= i + 2 && j < trs.length; j++) {
      const subTr = trs[j];
      const ath = parseAthleteLink(subTr);
      if (!ath) break;

      // Cells: [empty, bib, name, empty, s1, s2, s3, "total-innersx", ...]
      const subCells = extractCells(subTr);
      const s1 = parseFloat(subCells[4] ?? "") || 0;
      const s2 = parseFloat(subCells[5] ?? "") || 0;
      const s3 = parseFloat(subCells[6] ?? "") || 0;
      const subTotalRaw = subCells[7] ?? "";
      const subTotalMatch = subTotalRaw.match(/^(\d+)\s*(?:-\s*(\d+)x\s*)?$/);
      const subTotal = subTotalMatch ? parseInt(subTotalMatch[1]) : 0;
      const series = [s1, s2, s3].filter((n) => n > 0);

      // Gender from ISSF ID: SH{NOC3}{G}... → index 5 is M/W/F
      const genderChar = ath.issfId[5]?.toUpperCase();
      if (!mInfo && genderChar === "M") {
        mInfo = ath; mSeries = series; mTotal = subTotal;
      } else if (!fInfo && (genderChar === "W" || genderChar === "F")) {
        fInfo = ath; fSeries = series; fTotal = subTotal;
      } else if (!mInfo) {
        mInfo = ath; mSeries = series; mTotal = subTotal;
      } else {
        fInfo = ath; fSeries = series; fTotal = subTotal;
      }
    }

    results.push({
      rank, nocCode,
      mIssfId: mInfo?.issfId ?? null, mLastName: mInfo?.lastName ?? "", mFirstName: mInfo?.firstName ?? "",
      mSeries, mTotal,
      fIssfId: fInfo?.issfId ?? null, fLastName: fInfo?.lastName ?? "", fFirstName: fInfo?.firstName ?? "",
      fSeries, fTotal,
      total, inners, qualified,
    });
  }

  return results;
}

/**
 * Scrape ISSF mixed team final results (elimination format).
 *
 * Row 0 — team row:   rank | bib | NOC | cumulative... | total | remarks
 * Row 1 — male:       athlete link + shot columns
 * Row 2 — female:     athlete link + shot columns
 */
export async function fetchMixedTeamFinalFromHtml(
  competitionId: number,
  resultKey: string,
  noCache = false
): Promise<ISSFMixedTeamFinalEntry[]> {
  const url = `${ISSF_WEB}/competitions/${competitionId}/results/${resultKey}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    ...(noCache ? { cache: "no-store" as const } : { next: { revalidate: 3600 } }),
  });
  if (!res.ok) throw new Error(`ISSF mixed team final fetch failed: ${res.status} ${url}`);
  const html = await res.text();

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const trs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) trs.push(m[1]);

  const results: ISSFMixedTeamFinalEntry[] = [];

  for (let i = 0; i < trs.length; i++) {
    const tr = trs[i];
    if (/<a\s+href="\/athletes\//i.test(tr)) continue;

    const cells = extractCells(tr);
    const rank = parseInt(cells[0]);
    if (isNaN(rank) || rank <= 0) continue;

    const nocIdx = cells.findIndex((c) => /^[A-Z]{3}$/.test(c));
    if (nocIdx < 0) continue;
    const nocCode = cells[nocIdx];

    const boldRe = /<td[^>]*class="bold black"[^>]*>([\d.]+)<\/td>/g;
    const boldVals: number[] = [];
    let bm: RegExpExecArray | null;
    while ((bm = boldRe.exec(tr)) !== null) {
      const v = parseFloat(bm[1]);
      if (!isNaN(v)) boldVals.push(v);
    }
    if (boldVals.length < 2) {
      const nums = cells.slice(nocIdx + 1).filter((c) => /^\d+(\.\d+)?$/.test(c)).map(Number);
      if (nums.length < 2) continue;
      boldVals.push(...nums);
    }

    const total = boldVals[boldVals.length - 1];
    const stageCumulatives = boldVals.slice(0, -1);
    const shootOff = />\s*SO\s*</.test(tr);

    let mInfo: { issfId: string; lastName: string; firstName: string } | null = null;
    let fInfo: { issfId: string; lastName: string; firstName: string } | null = null;

    for (let j = i + 1; j <= i + 2 && j < trs.length; j++) {
      const ath = parseAthleteLink(trs[j]);
      if (!ath) break;
      const genderChar = ath.issfId[5]?.toUpperCase();
      if (!mInfo && genderChar === "M") mInfo = ath;
      else if (!fInfo && (genderChar === "W" || genderChar === "F")) fInfo = ath;
      else if (!mInfo) mInfo = ath;
      else fInfo = ath;
    }

    results.push({
      rank, nocCode,
      mIssfId: mInfo?.issfId ?? null, mLastName: mInfo?.lastName ?? "", mFirstName: mInfo?.firstName ?? "",
      fIssfId: fInfo?.issfId ?? null, fLastName: fInfo?.lastName ?? "", fFirstName: fInfo?.firstName ?? "",
      stageCumulatives, total, shootOff,
    });
  }

  return results;
}
