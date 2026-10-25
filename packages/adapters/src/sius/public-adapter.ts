import { normalizeNoc } from "@shootermarkt/db/name-match";
const SIUS_PUB = "https://shootingsportscloud.com:8594/api/v1/pub";

export const MIXED_TEAM_CODES = new Set(["ARMT", "APMT"]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SiusEvent {
  runningId: string;
  eventCode: string;
  name: string;
  state: string; // "Planned" | "InCompetition" | "Finished"
  startDate: string;
}

export interface SiusSubEvent {
  runningId: string;
  name: string;
  state: string;
  hidden: boolean;
}

/** Extra per-row SIUS marks: PenaltyRemark text, ShootOffRemark ("SO", "+10", "+1+1+3"), RecordRemark ("WR", "QWR"…). */
export interface SiusExtraRemarks {
  penalty: string | null;
  shootOff: string | null;
  record: string | null;
}

/** `includeUnranked`: also return DSQ/DNS rows that SIUS leaves without a rank (live cron leaves them out). */
export interface FetchOpts { includeUnranked?: boolean; shooterGroup?: string }

/** Juniorski događaji (ARMJ, APMTJ…) imaju strelce u SIUS grupi "Junior"; ostali u "Regulars". */
export const isJuniorEventCode = (code: string) => /^[A-Z0-9]+J$/.test(code);
const groupFor = (code: string) => (isJuniorEventCode(code) ? "Junior" : "Regulars");

/** Juniori su u grupi "Junior" ili (npr. EP U18 Tallinn) u "Regulars" — probaj redom dok SIUS ne vrati redove. */
async function pubSeries<T>(query: string, group: string): Promise<T> {
  const groups = group === "Junior" ? ["Junior", "Regulars"] : [group];
  let raw!: T;
  for (const g of groups) {
    raw = await pub<T>(`/series?${query}&shooterGroup=${g}`);
    if (!Array.isArray(raw) || raw.length > 0) break;
  }
  return raw;
}

export interface SiusLiveResult extends SiusExtraRemarks {
  /** null = SIUS gave no rank (DSQ/DNS rows). Such rows carry a status remark and total 0. */
  rank: number | null;
  displayName: string;
  firstName: string;
  lastName: string;
  nation: string;       // ISO 3-letter
  total: number;
  inners: number | null; // NumberOfInnerTen — relevant for AP disciplines
  series: number[];      // per-series totals (summed shots within each group)
  siusAthleteId: string | null;
  qualified: boolean;    // Result.Extensions["QualificationRemark"] === "Q"
  remark: string | null; // ShooterGroupRemark (RPO) or StatusRemark (DSQ/DNS/DNF), whichever is set
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function pub<T>(path: string): Promise<T> {
  const res = await fetch(`${SIUS_PUB}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SIUS pub ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export interface SiusCompetition {
  id: string; // RunningId = the "SIUS UUID" stored in competitions.scius_id
  name: string;
  city: string | null;
  country: string | null;
  start: string; // YYYY-MM-DD
  end: string;
}

/** All public SIUS competitions starting on/after `fromDate` (YYYY-MM-DD). */
export async function fetchSiusCompetitions(fromDate: string): Promise<SiusCompetition[]> {
  const qs = new URLSearchParams({ Page: "1", PageSize: "9999", Name: "", Sort: '{"StartDate":"desc"}', IsPublic: "true" });
  const json = await pub<{ data: Array<Record<string, string | null>> }>(`/competitions?${qs}`);
  return json.data
    .map((c) => ({
      id: c.RunningId!, name: c.Name ?? "", city: c.City ?? null, country: c.Country ?? null,
      start: (c.StartDate ?? "").slice(0, 10), end: (c.EndDate ?? "").slice(0, 10),
    }))
    .filter((c) => c.id && c.start >= fromDate);
}

export async function fetchSiusEvents(compUuid: string): Promise<SiusEvent[]> {
  const data = await pub<RawEvent[]>(
    `/competitions/events?CompetitionId=${compUuid}`
  );
  return data.map((e) => ({
    runningId: e.RunningId,
    eventCode: e.CompetitionEventType?.EventCode ?? "",
    name: e.CompetitionEventType?.Name ?? "",
    state: e.State,
    startDate: e.Startdate,
  }));
}

export async function fetchSiusSubEvents(
  compUuid: string,
  eventUuid: string
): Promise<SiusSubEvent[]> {
  const data = await pub<RawSubEvent[]>(
    `/competitions/${compUuid}/events/${eventUuid}/subevents`
  );
  return data
    .filter((s) => !s.Hidden)
    .map((s) => ({
      runningId: s.RunningId,
      name: s.Name,
      state: s.State,
      hidden: s.Hidden,
    }));
}

/** Same as fetchSiusSubEvents but includes hidden sub-events (needed for debug). */
export async function fetchSiusSubEventsAll(
  compUuid: string,
  eventUuid: string
): Promise<SiusSubEvent[]> {
  const data = await pub<RawSubEvent[]>(
    `/competitions/${compUuid}/events/${eventUuid}/subevents`
  );
  return data.map((s) => ({
    runningId: s.RunningId,
    name: s.Name,
    state: s.State,
    hidden: s.Hidden,
  }));
}

export async function fetchSiusSeries(
  compUuid: string,
  eventUuid: string,
  subEventUuid: string,
  opts: FetchOpts = {}
): Promise<SiusLiveResult[]> {
  const raw = await pubSeries<RawSeries | RawSeries[]>(
    `runningCompetitionId=${compUuid}` +
      `&runningCompetitionEventId=${eventUuid}` +
      `&subEventId=${subEventUuid}` +
      `&teamKind=Individual`,
    opts.shooterGroup ?? "Regulars"
  );

  const data: RawSeries = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  const rows = data["Series-Individual"] ?? [];
  return rows.flatMap((row) => {
    const parsedRank = parseInt(row.Rank?.DisplayText ?? "", 10);
    const rank = isNaN(parsedRank) ? null : parsedRank;
    const extensions = row.Result?.Extensions ?? [];
    // Unranked rows are kept only when SIUS marks a status (DSQ/DNS/DNF); otherwise they are in-progress noise.
    if (rank === null && !(opts.includeUnranked && extensions.some((e) => e.Key === "StatusRemark"))) return [];

    const athlete = row.AthletesSeries?.[0];
    if (!athlete) return [];

    // Stariji SIUS format (2025) nema TotalScore/NumberOfInnerTen — rezultat je samo string "632.8" / "577-18x".
    const fromResult = parseTeamValue(athlete.Result ?? row.Result?.Value ?? "");
    const total = athlete.TotalScore ?? fromResult.total;
    const inners =
      typeof athlete.NumberOfInnerTen === "number" ? athlete.NumberOfInnerTen : fromResult.inners;

    const series = parseSeriesTotals(athlete.Series ?? []);

    const { firstName, lastName } = splitDisplayName(row.DisplayName ?? "");
    const { qualified, remark, ...extra } = parseRemark(extensions);

    return [
      {
        rank,
        ...extra,
        displayName: row.DisplayName ?? "",
        firstName,
        lastName,
        nation: normalizeNoc(row.Nation) ?? "",
        total,
        inners: inners === 0 ? null : inners, // 0 = not applicable (AR disciplines)
        series,
        siusAthleteId: athlete.AthleteIdentifier?.Identifier ?? null,
        qualified,
        remark,
      },
    ];
  });
}

export interface SiusElimRound {
  round: number;
  results: SiusLiveResult[];
}

export interface SiusLiveData {
  qual: SiusLiveResult[];
  elim: SiusElimRound[];
  final: SiusLiveResult[];
  /** Redni broj meča iste discipline na takmičenju (1 = prvi); >1 kad SIUS ima ponovljen događaj */
  match?: number;
  /** Datum početka SIUS događaja (YYYY-MM-DD, UTC) */
  date?: string;
  /** Koliko mečeva te discipline takmičenje ima po SIUS rasporedu (različiti dani), i pre nego što svi počnu */
  matchCount?: number;
}

/** Ključ mape iz fetchLiveSiusResults: "ARM" za prvi meč, "ARM#2" za drugi… */
export function parseSiusMatchKey(key: string): { eventCode: string; match: number } {
  const [eventCode, n] = key.split("#");
  return { eventCode, match: n ? Number(n) : 1 };
}

/**
 * Raspodela SIUS događaja iste discipline na mečeve, hronološki. Svaki događaj sa sopstvenom
 * kvalifikacijom je zaseban meč (npr. dva dana pojedinačnog na H&N Cup-u); događaj bez
 * kvalifikacije (samo eliminacija/finale objavljeni odvojeno) nastavlja prethodni meč.
 * Ništa se ne prepisuje — svaki meč dobija svoj ključ.
 */
export function assignSiusMatches(events: Array<{ eventCode: string; startDate: string; data: SiusLiveData }>): Map<string, SiusLiveData> {
  const out = new Map<string, SiusLiveData>();
  const count = new Map<string, number>();
  for (const { eventCode, startDate, data } of [...events].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const n = count.get(eventCode) ?? 0;
    const key = (m: number) => (m === 1 ? eventCode : `${eventCode}#${m}`);
    const current = n ? out.get(key(n)) : undefined;
    if (current && data.qual.length === 0) {
      current.elim.push(...data.elim);
      if (data.final.length > 0) current.final = data.final;
      continue;
    }
    count.set(eventCode, n + 1);
    out.set(key(n + 1), { ...data, match: n + 1, date: startDate.slice(0, 10) });
  }
  return out;
}

function isElimSubEvent(name: string): boolean {
  return /elim/i.test(name);
}

function isFinalSubEvent(name: string): boolean {
  return /final/i.test(name);
}

/** Mešoviti timovi: finale je jedan "Final" (od 2026) ili "Gold/Bronze Medal Match" (do 2025, mečevi na poene). */
function isMixedFinalSubEvent(name: string): boolean {
  return isFinalSubEvent(name) || /medal match/i.test(name);
}

function elimRoundNumber(name: string, fallback: number): number {
  const m = name.match(/(\d+)\s*$/);
  return m ? parseInt(m[1]) : fallback;
}

/**
 * Fetch all live/finished qual and elimination results for the given discipline codes.
 * Returns a map of match key ("ARM", "ARM#2"…, vidi parseSiusMatchKey) → { qual, elim[], final }.
 */
export async function fetchLiveSiusResults(
  compUuid: string,
  disciplineCodes: string[],
  opts: FetchOpts = {}
): Promise<Map<string, SiusLiveData>> {
  const fetched: Array<{ eventCode: string; startDate: string; data: SiusLiveData }> = [];

  const allEvents = await fetchSiusEvents(compUuid);
  const relevantEvents = allEvents.filter((e) => disciplineCodes.includes(e.eventCode));

  await Promise.all(
    relevantEvents.map(async (event) => {
      let subEvents: SiusSubEvent[];
      try {
        subEvents = await fetchSiusSubEventsAll(compUuid, event.runningId);
      } catch {
        return;
      }

      const evOpts = { ...opts, shooterGroup: groupFor(event.eventCode) };
      const done = subEvents.filter((s) => s.state !== "Planned");
      // Qual: visible only (avoid hidden aggregated/combined sub-events)
      const qualSubs = done.filter((s) => !s.hidden && !isElimSubEvent(s.name) && !isFinalSubEvent(s.name));
      // Elim/final: include hidden (SIUS sometimes marks these as hidden)
      const elimSubs = done.filter((s) => isElimSubEvent(s.name));
      const finalSub = done.find((s) => isFinalSubEvent(s.name));

      const data: SiusLiveData = { qual: [], elim: [], final: [] };

      // Fetch ALL qual sub-events in parallel and merge (R3P has multiple relays)
      const qualResults = await Promise.all(
        qualSubs.map((sub) =>
          fetchSiusSeries(compUuid, event.runningId, sub.runningId, evOpts).catch(() => [])
        )
      );
      data.qual.push(...qualResults.flat());
      // Re-rank merged qual by total desc
      if (qualSubs.length > 1 && data.qual.length > 0) {
        const ranked = data.qual.filter((r) => r.rank !== null);
        const unranked = data.qual.filter((r) => r.rank === null);
        ranked.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
        ranked.forEach((r, i) => { r.rank = i + 1; });
        data.qual = [...ranked, ...unranked];
      }

      // Elimination rounds (one per sub-event, ordered by round number), fetched in parallel
      const elimResults = await Promise.all(
        elimSubs.map((sub, i) =>
          fetchSiusSeries(compUuid, event.runningId, sub.runningId, evOpts)
            .then((r) => ({ round: elimRoundNumber(sub.name, i + 1), results: r }))
            .catch(() => ({ round: elimRoundNumber(sub.name, i + 1), results: [] as SiusLiveResult[] }))
        )
      );
      for (const er of elimResults) {
        if (er.results.length > 0) data.elim.push(er);
      }

      // Final sub-event
      if (finalSub) {
        try {
          data.final = await fetchSiusSeries(compUuid, event.runningId, finalSub.runningId, evOpts);
        } catch { /* ignore */ }
      }

      if (data.qual.length > 0 || data.elim.length > 0 || data.final.length > 0) {
        data.matchCount = new Set(relevantEvents.filter((e) => e.eventCode === event.eventCode).map((e) => e.startDate.slice(0, 10))).size;
        fetched.push({ eventCode: event.eventCode, startDate: event.startDate, data });
      }
    })
  );

  return assignSiusMatches(fetched);
}

// ── Mixed team (ARMT / APMT) ────────────────────────────────────────────────────

export interface SiusTeamAthlete {
  siusAthleteId: string | null;
  firstName: string;
  lastName: string;
  nation: string;
  total: number;
  inners: number | null;
  series: number[];
}

export interface SiusTeamResult extends SiusExtraRemarks {
  rank: number | null; // null = no rank from SIUS (DSQ/DNS)
  nocCode: string;
  total: number;
  inners: number | null; // APMT qual only — ARMT and any final is plain decimal
  qualified: boolean;
  remark: string | null;
  statusRemark: string | null;
  athletes: SiusTeamAthlete[]; // ordered by TeamIndex, len 2
}

export interface SiusMixedTeamData {
  qual: SiusTeamResult[];
  final: SiusTeamResult[];
}

/** A team row can retain an athlete's historical federation (e.g. RUS), while
 * its members carry the competition NOC (AIN). Prefer the shared member NOC. */
export function resolveTeamNoc(teamNoc: string, athletes: Pick<SiusTeamAthlete, "nation">[]): string {
  const athleteNocs = [...new Set(athletes.map((a) => a.nation).filter(Boolean))];
  return athleteNocs.length === 1 ? athleteNocs[0] : teamNoc;
}

/** Stable across qualification/final and independent from a federation label.
 * AIN combines multiple federations, so a displayed team number is not unique. */
export function mixedTeamIdentity(athletes: Pick<SiusTeamAthlete, "siusAthleteId" | "firstName" | "lastName">[]): string {
  return athletes
    .map((a) => a.siusAthleteId ?? `${a.lastName}\u0000${a.firstName}`)
    .sort()
    .join("|");
}

/** SIUS team totals come as "591-32x" (total-inners) for APMT qual, or a plain
 *  decimal string ("488.4") everywhere else (ARMT, and any final). */
function parseTeamValue(value: string): { total: number; inners: number | null } {
  const dash = value.indexOf("-");
  if (dash === -1) return { total: parseFloat(value) || 0, inners: null };
  const inners = parseInt(value.slice(dash + 1), 10);
  return { total: parseFloat(value.slice(0, dash)) || 0, inners: isNaN(inners) ? null : inners };
}

function parseTeamRemark(extensions: Array<{ Key: string; Value: string }>): {
  qualified: boolean;
  remark: string | null;
  /** Short mark only (DSQ/DNS/DNF/RPO) — fits qual_remark; `remark` below may be a long penalty sentence. */
  statusRemark: string | null;
} & SiusExtraRemarks {
  const byKey = Object.fromEntries(extensions.map((e) => [e.Key, e.Value]));
  const statusRemark = byKey.StatusRemark ?? byKey.ShooterGroupRemark ?? null;
  return {
    // Do 2025: "QG"/"QB" = plasman u meč za zlato/bronzu; od 2026 samo "Q".
    qualified: /^Q[GB]?$/.test(byKey.QualificationRemark ?? ""),
    remark: byKey.StatusRemark ?? byKey.PenaltyRemark ?? byKey.ShooterGroupRemark ?? null,
    statusRemark,
    penalty: byKey.PenaltyRemark ?? null,
    shootOff: byKey.ShootOffRemark ?? null,
    record: byKey.RecordRemark ?? null,
  };
}

async function fetchSiusTeamSeries(
  compUuid: string,
  eventUuid: string,
  subEventUuid: string,
  opts: FetchOpts = {}
): Promise<SiusTeamResult[]> {
  const raw = await pubSeries<RawTeamSeries | RawTeamSeries[]>(
    `runningCompetitionId=${compUuid}` +
      `&runningCompetitionEventId=${eventUuid}` +
      `&subEventId=${subEventUuid}` +
      `&teamKind=TeamOfIndividuals`,
    opts.shooterGroup ?? "Regulars"
  );

  const data: RawTeamSeries = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  const rows = data["Series-TeamOfIndividuals"] ?? [];
  return rows.flatMap((row) => {
    const parsedRank = parseInt(row.Rank?.DisplayText ?? "", 10);
    const rank = isNaN(parsedRank) ? null : parsedRank;
    const teamExt = row.Result?.Extensions ?? [];
    if (rank === null && !(opts.includeUnranked && teamExt.some((e) => e.Key === "StatusRemark"))) return [];

    const { total, inners } = parseTeamValue(row.Result?.Value ?? "");
    const athletes: SiusTeamAthlete[] = (row.AthletesSeries ?? [])
      .slice()
      .sort((a, b) => (a.TeamIndex ?? 0) - (b.TeamIndex ?? 0))
      .map((a) => {
        const { firstName, lastName } = splitDisplayName(a.DisplayName ?? "");
        const { total: aTotal, inners: aInners } = parseTeamValue(a.Result ?? "");
        return {
          siusAthleteId: a.AthleteIdentifier?.Identifier ?? null,
          firstName,
          lastName,
          nation: normalizeNoc(a.Nation) ?? "",
          total: aTotal,
          inners: aInners,
          series: parseSeriesTotals(a.Series ?? []),
        };
      });

    return [
      {
        rank,
        nocCode: resolveTeamNoc(row.Nation ?? "", athletes),
        total,
        inners,
        athletes,
        ...parseTeamRemark(teamExt),
      },
    ];
  });
}

/** Fetch mixed-team qual + final for the given mixed-team discipline codes
 *  (subset of MIXED_TEAM_CODES). Unlike individual finals, SIUS keeps the
 *  whole mixed-team final in a single sub-event — eliminated teams simply
 *  have blank trailing series instead of a separate elim sub-event. */
export async function fetchLiveSiusMixedTeamResults(
  compUuid: string,
  disciplineCodes: string[],
  opts: FetchOpts = {}
): Promise<Map<string, SiusMixedTeamData>> {
  const out = new Map<string, SiusMixedTeamData>();

  const allEvents = await fetchSiusEvents(compUuid);
  const relevantEvents = allEvents.filter((e) => disciplineCodes.includes(e.eventCode));

  await Promise.all(
    relevantEvents.map(async (event) => {
      let subEvents: SiusSubEvent[];
      try {
        subEvents = await fetchSiusSubEventsAll(compUuid, event.runningId);
      } catch {
        return;
      }

      const evOpts = { ...opts, shooterGroup: groupFor(event.eventCode) };
      const done = subEvents.filter((s) => s.state !== "Planned");
      const qualSubs = done.filter((s) => !isMixedFinalSubEvent(s.name));
      // Jedno finale, ili dva meča (zlato: 1–2, bronza: 3–4) čiji se redovi spajaju.
      const finalSubs = done.filter((s) => isMixedFinalSubEvent(s.name));

      const data: SiusMixedTeamData = { qual: [], final: [] };

      const qualResults = await Promise.all(
        qualSubs.map((sub) =>
          fetchSiusTeamSeries(compUuid, event.runningId, sub.runningId, evOpts).catch(() => [])
        )
      );
      data.qual.push(...qualResults.flat());
      if (qualSubs.length > 1 && data.qual.length > 0) {
        const ranked = data.qual.filter((r) => r.rank !== null);
        const unranked = data.qual.filter((r) => r.rank === null);
        ranked.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
        ranked.forEach((r, i) => { r.rank = i + 1; });
        data.qual = [...ranked, ...unranked];
      }

      const finalResults = await Promise.all(
        finalSubs.map((sub) => fetchSiusTeamSeries(compUuid, event.runningId, sub.runningId, evOpts).catch(() => []))
      );
      data.final = finalResults.flat();

      if (data.qual.length > 0 || data.final.length > 0) {
        // ponovljen događaj (drugi meč) ne prepisuje prvi — dobija ključ "ARMT#2" (vidi parseSiusMatchKey)
        const n = relevantEvents
          .filter((e) => e.eventCode === event.eventCode)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .indexOf(event) + 1;
        out.set(n === 1 ? event.eventCode : `${event.eventCode}#${n}`, data);
      }
    })
  );

  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSeriesTotals(
  seriesRaw: Array<Array<{ Value: string }>>
): number[] {
  // SIUS: [[{Value:"106.3"}, {Value:"105.9"}, ...]] — outer array is always len 1,
  // inner array holds one entry per series (already totalled by SIUS)
  return seriesRaw
    .flatMap((group) => group)
    .map((s) => parseFloat(s.Value))
    .filter((v) => !isNaN(v));
}

/** Reads the per-row remark extensions SIUS attaches to `Result`:
 *  - QualificationRemark "Q" → athlete officially qualified for the final
 *  - ShooterGroupRemark "RPO" → ranking points only (nation qualification quota),
 *    can never advance to the final regardless of rank
 *  - StatusRemark "DSQ" | "DNS" | "DNF" → competition status
 *  ShooterGroupRemark and StatusRemark are mutually exclusive with qualifying;
 *  prefer StatusRemark (a DSQ overrides an RPO tag) when both are somehow present. */
function parseRemark(extensions: Array<{ Key: string; Value: string }>): {
  qualified: boolean;
  remark: string | null;
} & SiusExtraRemarks {
  const byKey = Object.fromEntries(extensions.map((e) => [e.Key, e.Value]));
  return {
    qualified: byKey.QualificationRemark === "Q",
    remark: byKey.StatusRemark ?? byKey.ShooterGroupRemark ?? null,
    penalty: byKey.PenaltyRemark ?? null,
    shootOff: byKey.ShootOffRemark ?? null,
    record: byKey.RecordRemark ?? null,
  };
}

/** SIUS: "HRBEKOVA Danka" → { lastName: "HRBEKOVA", firstName: "Danka" }
 *  Handles compound last names: "KOCHALUMKAL VINOD Vidarsa" → { lastName: "KOCHALUMKAL VINOD", firstName: "Vidarsa" }
 *  Rule: leading consecutive ALL-CAPS words = last name, rest = first name. */
export function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  let split = 1;
  for (let i = 1; i < parts.length; i++) {
    if (/^[\p{Lu}\-']+$/u.test(parts[i])) split = i + 1; // i Č/Š/Ž… ("BOLA UJČIČ Denis")
    else break;
  }
  // Sve velikim slovima ("HEINRICH ALISON"): poslednja reč je ime, ne deo prezimena.
  if (split === parts.length) split = parts.length - 1;
  return { lastName: parts.slice(0, split).join(" "), firstName: parts.slice(split).join(" ") };
}

// ── Raw response types ────────────────────────────────────────────────────────

interface RawEvent {
  RunningId: string;
  CompetitionEventType?: { EventCode: string; Name: string };
  State: string;
  Startdate: string;
}

interface RawSubEvent {
  RunningId: string;
  Name: string;
  State: string;
  Hidden: boolean;
}

interface RawSeries {
  "Series-Individual"?: RawSeriesRow[];
}

interface RawSeriesRow {
  Rank?: { DisplayText: string };
  Result?: { Order: number; Value: string; Extensions?: Array<{ Key: string; Value: string }> };
  DisplayName?: string;
  Nation?: string;
  AthletesSeries?: RawAthleteSeries[];
}

interface RawAthleteSeries {
  AthleteIdentifier?: { Identifier?: string };
  TotalScore?: number;
  NumberOfInnerTen?: number;
  Result?: string;
  Series?: Array<Array<{ Order: number; Value: string }>>;
}

interface RawTeamSeries {
  "Series-TeamOfIndividuals"?: RawTeamSeriesRow[];
}

interface RawTeamSeriesRow {
  Rank?: { DisplayText: string };
  Result?: { Order: number; Value: string; Extensions?: Array<{ Key: string; Value: string }> };
  DisplayName?: string;
  Nation?: string;
  AthletesSeries?: RawTeamAthleteSeries[];
}

interface RawTeamAthleteSeries {
  AthleteIdentifier?: { Identifier?: string };
  DisplayName?: string;
  Nation?: string;
  Result?: string;
  TeamIndex?: number;
  Remark?: string;
  Series?: Array<Array<{ Order: number; Value: string }>>;
}
