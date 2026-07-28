import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";

const SSC_API = "https://shootingsportscloud.com:8599";
const AUTH_URL = "https://shootingsportscloud.com:8597/oauth2/token";
const CLIENT_ID = process.env.SSC_CLIENT_ID!;
const CLIENT_SECRET = process.env.SSC_CLIENT_SECRET!;

export interface SscCompetition {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  status: string | null;
  exerciseDefinitions: SscExercise[];
}

export interface SscExercise {
  exerciseDefinitionId: string;
  name: string;
}

interface SscParticipant {
  id: string;
  firstName: string;
  lastName: string;
  gender: string | null; // "Male" | "Female" | null
  dateOfBirth: string | null;
  nocId: string | null;
  clubName: string | null;
}

interface SscResult {
  participantId: string;
  exerciseDefinitionId: string;
  rank: number | null;
  totalScore: number | null;
  seriesScores: number[] | null;
  inners: number | null;
  qualified: boolean | null;
}

let _accessToken: string | null = null;
let _tokenExpiry = 0;

export async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const refreshToken = process.env.SSC_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("SSC_REFRESH_TOKEN not set");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SSC token refresh failed (${res.status}): ${txt}`);
  }

  const data = await res.json();
  _accessToken = data.access_token as string;
  // token valid for expires_in seconds, refresh 60s early
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}

async function sscFetch<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${SSC_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SSC ${path} → ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCompetitions(): Promise<SscCompetition[]> {
  const data = await sscFetch<{ totalCount: number; data: SscCompetition[] }>(
    "/api/competitions"
  );
  return data.data ?? [];
}

export async function fetchCompetitionDetails(id: string): Promise<SscCompetition> {
  return sscFetch<SscCompetition>(`/api/competitions/${id}`);
}

export async function fetchCompetitionParticipants(id: string): Promise<SscParticipant[]> {
  const data = await sscFetch<SscParticipant[] | { data: SscParticipant[] }>(
    `/api/competitions/${id}/participants`
  );
  return Array.isArray(data) ? data : (data.data ?? []);
}

export async function fetchCompetitionResultDetails(
  competitionId: string,
  exerciseDefinitionId: string
): Promise<SscResult[]> {
  const data = await sscFetch<SscResult[] | { data: SscResult[] }>(
    `/api/user-results/exercises/details?competitionId=${competitionId}&exerciseDefinitionId=${exerciseDefinitionId}`
  );
  return Array.isArray(data) ? data : (data.data ?? []);
}

const DISC_MAP: Record<string, { male: string; female: string }> = {
  "10m Air Rifle":      { male: "ARM", female: "ARW" },
  "10m Air Rifle 30 Shots": { male: "ARM", female: "ARW" },
  "10m Air Pistol":     { male: "APM", female: "APW" },
  "10m Air Pistol 30 Shots": { male: "APM", female: "APW" },
};

function resolveDisc(exerciseName: string, gender: string | null): string | null {
  const mapping = DISC_MAP[exerciseName];
  if (!mapping) return null;
  return gender?.toLowerCase() === "female" ? mapping.female : mapping.male;
}

export async function buildReviewRows(competitionId: string): Promise<ReviewRow[]> {
  const [comp, participants] = await Promise.all([
    fetchCompetitionDetails(competitionId),
    fetchCompetitionParticipants(competitionId),
  ]);

  const participantMap = new Map<string, SscParticipant>(
    participants.map((p) => [p.id, p])
  );

  const rows: ReviewRow[] = [];

  for (const exercise of comp.exerciseDefinitions ?? []) {
    const disciplineCode = resolveDisc(exercise.name, null);
    if (!disciplineCode) continue; // skip non-10m

    let results: SscResult[] = [];
    try {
      results = await fetchCompetitionResultDetails(competitionId, exercise.exerciseDefinitionId);
    } catch {
      continue;
    }

    for (const r of results) {
      const p = participantMap.get(r.participantId);
      if (!p) continue;

      const disc = resolveDisc(exercise.name, p.gender) ?? disciplineCode;

      rows.push({
        lastName: p.lastName,
        firstName: p.firstName,
        teamNoc: p.nocId ?? "—",
        disciplineCode: disc as ReviewRow["disciplineCode"],
        category: "senior",
        qualRank: r.rank ?? undefined,
        qualTotal: r.totalScore ?? 0,
        qualInners: r.inners ?? null,
        qualSeries: r.seriesScores ?? [],
        qualified: r.qualified ?? undefined,
        skip: false,
      });
    }
  }

  return rows;
}
