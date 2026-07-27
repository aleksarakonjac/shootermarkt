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

export interface SiusLiveResult {
  rank: number;
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
  subEventUuid: string
): Promise<SiusLiveResult[]> {
  const raw = await pub<RawSeries | RawSeries[]>(
    `/series?runningCompetitionId=${compUuid}` +
      `&runningCompetitionEventId=${eventUuid}` +
      `&subEventId=${subEventUuid}` +
      `&shooterGroup=Regulars&teamKind=Individual`
  );

  const data: RawSeries = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  const rows = data["Series-Individual"] ?? [];
  return rows.flatMap((row) => {
    const rank = parseInt(row.Rank?.DisplayText ?? "", 10);
    if (isNaN(rank)) return [];

    const athlete = row.AthletesSeries?.[0];
    if (!athlete) return [];

    const total = athlete.TotalScore ?? 0;
    const inners =
      typeof athlete.NumberOfInnerTen === "number" ? athlete.NumberOfInnerTen : null;

    const series = parseSeriesTotals(athlete.Series ?? []);

    const { firstName, lastName } = splitDisplayName(row.DisplayName ?? "");
    const { qualified, remark } = parseRemark(row.Result?.Extensions ?? []);

    return [
      {
        rank,
        displayName: row.DisplayName ?? "",
        firstName,
        lastName,
        nation: row.Nation ?? "",
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
}

function isElimSubEvent(name: string): boolean {
  return /elim/i.test(name);
}

function isFinalSubEvent(name: string): boolean {
  return /final/i.test(name);
}

function elimRoundNumber(name: string, fallback: number): number {
  const m = name.match(/(\d+)\s*$/);
  return m ? parseInt(m[1]) : fallback;
}

/**
 * Fetch all live/finished qual and elimination results for the given discipline codes.
 * Returns a map of eventCode → { qual, elim[] }.
 */
export async function fetchLiveSiusResults(
  compUuid: string,
  disciplineCodes: string[]
): Promise<Map<string, SiusLiveData>> {
  const out = new Map<string, SiusLiveData>();

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
          fetchSiusSeries(compUuid, event.runningId, sub.runningId).catch(() => [])
        )
      );
      data.qual.push(...qualResults.flat());
      // Re-rank merged qual by total desc
      if (qualSubs.length > 1 && data.qual.length > 0) {
        data.qual.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
        data.qual.forEach((r, i) => { r.rank = i + 1; });
      }

      // Elimination rounds (one per sub-event, ordered by round number), fetched in parallel
      const elimResults = await Promise.all(
        elimSubs.map((sub, i) =>
          fetchSiusSeries(compUuid, event.runningId, sub.runningId)
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
          data.final = await fetchSiusSeries(compUuid, event.runningId, finalSub.runningId);
        } catch { /* ignore */ }
      }

      if (data.qual.length > 0 || data.elim.length > 0 || data.final.length > 0) {
        const existing = out.get(event.eventCode);
        if (existing) {
          if (data.qual.length > 0) existing.qual = data.qual;
          existing.elim.push(...data.elim);
          if (data.final.length > 0) existing.final = data.final;
        } else {
          out.set(event.eventCode, data);
        }
      }
    })
  );

  return out;
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

export interface SiusTeamResult {
  rank: number;
  nocCode: string;
  total: number;
  inners: number | null; // APMT qual only — ARMT and any final is plain decimal
  qualified: boolean;
  remark: string | null;
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
} {
  const byKey = Object.fromEntries(extensions.map((e) => [e.Key, e.Value]));
  return {
    qualified: byKey.QualificationRemark === "Q",
    remark: byKey.StatusRemark ?? byKey.PenaltyRemark ?? byKey.ShooterGroupRemark ?? null,
  };
}

async function fetchSiusTeamSeries(
  compUuid: string,
  eventUuid: string,
  subEventUuid: string
): Promise<SiusTeamResult[]> {
  const raw = await pub<RawTeamSeries | RawTeamSeries[]>(
    `/series?runningCompetitionId=${compUuid}` +
      `&runningCompetitionEventId=${eventUuid}` +
      `&subEventId=${subEventUuid}` +
      `&shooterGroup=Regulars&teamKind=TeamOfIndividuals`
  );

  const data: RawTeamSeries = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  const rows = data["Series-TeamOfIndividuals"] ?? [];
  return rows.flatMap((row) => {
    const rank = parseInt(row.Rank?.DisplayText ?? "", 10);
    if (isNaN(rank)) return [];

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
          nation: a.Nation ?? "",
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
        ...parseTeamRemark(row.Result?.Extensions ?? []),
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
  disciplineCodes: string[]
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

      const done = subEvents.filter((s) => s.state !== "Planned");
      const qualSubs = done.filter((s) => !isFinalSubEvent(s.name));
      const finalSub = done.find((s) => isFinalSubEvent(s.name));

      const data: SiusMixedTeamData = { qual: [], final: [] };

      const qualResults = await Promise.all(
        qualSubs.map((sub) =>
          fetchSiusTeamSeries(compUuid, event.runningId, sub.runningId).catch(() => [])
        )
      );
      data.qual.push(...qualResults.flat());
      if (qualSubs.length > 1 && data.qual.length > 0) {
        data.qual.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
        data.qual.forEach((r, i) => { r.rank = i + 1; });
      }

      if (finalSub) {
        try {
          data.final = await fetchSiusTeamSeries(compUuid, event.runningId, finalSub.runningId);
        } catch { /* ignore */ }
      }

      if (data.qual.length > 0 || data.final.length > 0) out.set(event.eventCode, data);
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
} {
  const byKey = Object.fromEntries(extensions.map((e) => [e.Key, e.Value]));
  return {
    qualified: byKey.QualificationRemark === "Q",
    remark: byKey.StatusRemark ?? byKey.ShooterGroupRemark ?? null,
  };
}

/** SIUS: "HRBEKOVA Danka" → { lastName: "HRBEKOVA", firstName: "Danka" }
 *  Handles compound last names: "KOCHALUMKAL VINOD Vidarsa" → { lastName: "KOCHALUMKAL VINOD", firstName: "Vidarsa" }
 *  Rule: leading consecutive ALL-CAPS words = last name, rest = first name. */
function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  let split = 1;
  for (let i = 1; i < parts.length; i++) {
    if (/^[A-Z\-']+$/.test(parts[i])) split = i + 1;
    else break;
  }
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
