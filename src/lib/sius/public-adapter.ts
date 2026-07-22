const SIUS_PUB = "https://shootingsportscloud.com:8594/api/v1/pub";

const MVP_CODES = new Set(["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW", "RFPM"]);

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

export async function fetchSiusSeries(
  compUuid: string,
  eventUuid: string,
  subEventUuid: string
): Promise<SiusLiveResult[]> {
  const data = await pub<RawSeries>(
    `/series?runningCompetitionId=${compUuid}` +
      `&runningCompetitionEventId=${eventUuid}` +
      `&subEventId=${subEventUuid}` +
      `&shooterGroup=Regulars&teamKind=Individual`
  );

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
      },
    ];
  });
}

/**
 * Convenience: for a given SIUS competition UUID + discipline codes, fetches
 * the currently active (InCompetition) qualification results for each discipline.
 * Returns a map of eventCode → results.
 */
export async function fetchLiveSiusResults(
  compUuid: string,
  disciplineCodes: string[]
): Promise<Map<string, SiusLiveResult[]>> {
  const out = new Map<string, SiusLiveResult[]>();

  const allEvents = await fetchSiusEvents(compUuid);
  const relevantEvents = allEvents.filter(
    (e) => disciplineCodes.includes(e.eventCode) || MVP_CODES.has(e.eventCode)
  );

  await Promise.all(
    relevantEvents.map(async (event) => {
      if (!disciplineCodes.includes(event.eventCode)) return;

      let subEvents: SiusSubEvent[];
      try {
        subEvents = await fetchSiusSubEvents(compUuid, event.runningId);
      } catch {
        return;
      }

      // prefer InCompetition, fall back to most recent non-hidden
      const activeSubEvent =
        subEvents.find((s) => s.state === "InCompetition") ??
        subEvents.filter((s) => s.state !== "Planned").at(-1);

      if (!activeSubEvent) return;

      let results: SiusLiveResult[];
      try {
        results = await fetchSiusSeries(
          compUuid,
          event.runningId,
          activeSubEvent.runningId
        );
      } catch {
        return;
      }

      if (results.length > 0) {
        out.set(event.eventCode, results);
      }
    })
  );

  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSeriesTotals(
  seriesRaw: Array<Array<{ Value: string }>>
): number[] {
  return seriesRaw.map((shots) =>
    shots.reduce((sum, s) => {
      const v = parseFloat(s.Value);
      return sum + (isNaN(v) ? 0 : v);
    }, 0)
  );
}

/** SIUS: "HRBEKOVA Danka" → { lastName: "HRBEKOVA", firstName: "Danka" } */
function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  return { firstName: parts.slice(1).join(" "), lastName: parts[0] };
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
