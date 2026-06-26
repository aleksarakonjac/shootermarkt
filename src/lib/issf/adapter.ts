const ISSF_API = "https://api.issf-sports.org/api/v01";

export type DisciplineCode = "ARM" | "ARW" | "APM" | "APW";

const ISSF_EVENT_MAP: Record<string, DisciplineCode> = {
  ARM: "ARM",
  ARW: "ARW",
  APM: "APM",
  APW: "APW",
};

export interface ISSFCompetition {
  id: number;
  name: string;
  dateFrom: string;
  dateTo: string;
  city: string;
  nationCode: string;
  nationName: string;
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
  achievements: ISSFAchievement[];
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

/** Extract MVP discipline events (ARM/ARW/APM/APW) from result groups, senior only. */
export function extractMvpEvents(
  groups: ISSFResultGroup[]
): Array<{
  disciplineCode: DisciplineCode;
  qualPhase: ISSFResultPhase | null;
  finalPhase: ISSFResultPhase | null;
}> {
  const out = [];
  for (const group of groups) {
    for (const event of group.competitionResultEvents) {
      const dc = ISSF_EVENT_MAP[event.eventCode];
      if (!dc || event.isJunior) continue;

      const phases = event.competitionResultPhases;
      const qualPhase = phases.find((p) => p.title === "Qualification") ?? null;
      const finalPhase = phases.find((p) => p.title === "Final") ?? null;

      out.push({ disciplineCode: dc, qualPhase, finalPhase });
    }
  }
  return out;
}

/** Search athletes by name. Returns up to ~50 results. */
export async function searchAthletes(query: string): Promise<ISSFAthlete[]> {
  const res = await fetch(
    `${ISSF_API}/athletes?search=${encodeURIComponent(query)}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`ISSF athlete search failed: ${res.status}`);
  const raw = await res.json();
  // Full profile is at /athletes/{issfId} — search returns lightweight list
  return raw;
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
