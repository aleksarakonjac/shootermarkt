import { fetchCompetitions } from "@/lib/issf/adapter";
import { fetchSssCalendar } from "@/lib/sss/adapter";

export type CalendarSource = "sss" | "issf" | "esc";

export interface CalendarEvent {
  source: CalendarSource;
  name: string;
  dateFrom: string | null; // YYYY-MM-DD
  dateTo: string | null;
  location: string | null;
  country: string | null;
  is10m: boolean;
  url: string | null;
  externalId: string | null;
}

// ── SSS ───────────────────────────────────────────────────────────────────────

export async function fetchSssEvents(year: number): Promise<CalendarEvent[]> {
  const raw = await fetchSssCalendar();
  const yearStr = String(year);
  return raw
    .filter((e) => !e.date || e.date.includes(yearStr.slice(-2)))
    .map((e) => ({
      source: "sss" as const,
      name: e.name,
      dateFrom: parseSssDate(e.date, year),
      dateTo: null,
      location: e.location ?? null,
      country: "SRB",
      is10m: e.is10m,
      url: null,
      externalId: null,
    }));
}

/** Parse SSS date like "13.01 - 18.01." to YYYY-MM-DD (start date) */
function parseSssDate(raw: string | null, year: number): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const d = m[1].padStart(2, "0");
  const mo = m[2].padStart(2, "0");
  return `${year}-${mo}-${d}`;
}

// ── ISSF ──────────────────────────────────────────────────────────────────────

export async function fetchIssfEvents(year: number): Promise<CalendarEvent[]> {
  const comps = await fetchCompetitions(year);
  return comps.map((c) => ({
    source: "issf" as const,
    name: c.name,
    dateFrom: c.dateFrom ? c.dateFrom.split("T")[0] : null,
    dateTo: c.dateTo ? c.dateTo.split("T")[0] : null,
    location: c.city ?? null,
    country: c.nationCode ?? null,
    is10m: true, // ISSF API returns only shooting comps; all have 10m events
    url: null,
    externalId: String(c.id),
  }));
}

// ── ESC ───────────────────────────────────────────────────────────────────────

const ESC_BASE = "https://esc-shooting.org";

export async function fetchEscEvents(year: number): Promise<CalendarEvent[]> {
  const res = await fetch(`${ESC_BASE}/calendar?year=${year}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESC calendar fetch failed: ${res.status}`);
  const html = await res.text();
  return parseEscHtml(html);
}

function parseEscHtml(html: string): CalendarEvent[] {
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const events: CalendarEvent[] = [];
  let row;

  while ((row = rowPattern.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell;
    while ((cell = cellRe.exec(row[1])) !== null) {
      const text = cell[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }

    // Skip header and short rows
    if (cells.length < 3 || cells[0] === "DATE") continue;

    // Columns: "DD.MM.YYYY DD.MM.YYYY" | name | event_type | country | city | results?
    const dateRaw = cells[0];
    const name = cells[1];
    const eventType = cells[2] ?? "";
    const country = cells[3] ?? null;
    const city = cells[4] ?? null;

    if (!name || name.length < 3) continue;

    // Parse dates: "DD.MM.YYYY DD.MM.YYYY" or "DD.MM.YYYY"
    const dates = dateRaw.match(/\d{2}\.\d{2}\.\d{4}/g) ?? [];
    const dateFrom = dates[0] ? escDateToIso(dates[0]) : null;
    const dateTo = dates[1] ? escDateToIso(dates[1]) : null;

    // 10m = air rifle or air pistol event types
    const upper = eventType.toUpperCase();
    const is10m =
      upper.includes("AR") ||
      upper.includes("AP") ||
      upper === "R-P" ||
      upper === "R/P" ||
      name.toUpperCase().includes("10M") ||
      name.toUpperCase().includes("AIR");

    events.push({
      source: "esc",
      name,
      dateFrom,
      dateTo,
      location: city,
      country,
      is10m,
      url: null,
      externalId: null,
    });
  }

  return events;
}

/** "DD.MM.YYYY" → "YYYY-MM-DD" */
function escDateToIso(raw: string): string {
  const [d, m, y] = raw.split(".");
  return `${y}-${m}-${d}`;
}

// ── Aggregator ────────────────────────────────────────────────────────────────

export async function fetchAllCalendarEvents(year: number): Promise<CalendarEvent[]> {
  const results = await Promise.allSettled([
    fetchSssEvents(year),
    fetchIssfEvents(year),
    fetchEscEvents(year),
  ]);

  const events: CalendarEvent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") events.push(...r.value);
  }
  return events;
}

/** Normalize name for dedup comparison */
export function normalizeEventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
