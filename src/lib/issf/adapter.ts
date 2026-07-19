const ISSF_API = "https://api.issf-sports.org/api/v01";
const ISSF_WEB = "https://www.issf-sports.org";

export type DisciplineCode = "ARM" | "ARW" | "APM" | "APW";

const ISSF_EVENT_MAP: Record<string, DisciplineCode> = {
  ARM: "ARM",
  ARW: "ARW",
  APM: "APM",
  APW: "APW",
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
export async function fetchAthleteProfile(issfId: string): Promise<Partial<ISSFAthlete>> {
  try {
    const res = await fetch(`${ISSF_API}/athletes/${issfId}`, { next: { revalidate: 86400 } });
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
}> {
  const out = [];
  for (const group of groups) {
    for (const event of group.competitionResultEvents) {
      const dc = ISSF_EVENT_MAP[event.eventCode];
      if (!dc) continue;

      const phases = event.competitionResultPhases;
      const qualPhase = phases.find((p) => p.title === "Qualification") ?? null;
      const finalPhase = phases.find((p) => p.title === "Final") ?? null;

      out.push({ disciplineCode: dc, category: event.isJunior ? "junior" as const : "senior" as const, qualPhase, finalPhase });
    }
  }
  return out;
}

const API_LIMIT = 300;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

async function searchRaw(query: string): Promise<ISSFAthlete[]> {
  const res = await fetch(
    `${ISSF_API}/athletes?search=${encodeURIComponent(query)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`ISSF athlete search failed: ${res.status}`);
  return res.json();
}

/** Search athletes by NOC. Paginates via alphabet if API limit is hit. */
export async function searchAthletes(noc: string): Promise<ISSFAthlete[]> {
  const first = await searchRaw(noc);

  if (first.length < API_LIMIT) return first;

  // Hit limit — fan out A–Z
  const seen = new Set<string>();
  const all: ISSFAthlete[] = [];

  for (const letter of ALPHABET) {
    const batch = await searchRaw(`${noc} ${letter}`);
    for (const a of batch) {
      if (!seen.has(a.issfId)) {
        seen.add(a.issfId);
        all.push(a);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
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
  resultKey: string
): Promise<ISSFQualResult[]> {
  const url = `${ISSF_WEB}/competitions/${competitionId}/results/${resultKey}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ISSF HTML fetch failed: ${res.status} ${url}`);
  const html = await res.text();

  const results: ISSFQualResult[] = [];

  // Match each result row: starts with a rank td, has athlete link, NOC, series, total
  const rowRe =
    /<tr>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>\d+<\/td>\s*<td[^>]*><a href="\/athletes\/([^"]+)">([^<]+)<\/a><\/td>\s*<td[^>]*>([A-Z]{3})<\/td>((?:\s*<td[^>]*>[^<]*<\/td>)+)\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>(Q)?[^<]*<\/td>/g;

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
    const qualified = m[7] === "Q";

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

    results.push({ rank, issfId, lastName, firstName, nationCode, series, total, inners, qualified });
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