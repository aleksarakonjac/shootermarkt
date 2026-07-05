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
  competitionTypeId?: number;
  competitionTypeName?: string;
  competitionTypeAcronym?: string;
}

// ── SSS ───────────────────────────────────────────────────────────────────────

export async function fetchSssEvents(year: number): Promise<CalendarEvent[]> {
  const raw = await fetchSssCalendar();
  // SSS calendar has no year in dates — publishes only current season, include all
  return raw
    .map((e) => {
      const { dateFrom, dateTo } = parseSssDates(e.date, year);
      return {
        source: "sss" as const,
        name: e.name,
        dateFrom,
        dateTo,
        location: e.location ?? null,
        country: "SRB",
        is10m: e.is10m,
        url: null,
        externalId: null,
      };
    });
}

/** Parse SSS date strings into ISO date range.
 *  Handles: "15.01.", "15-18.01.", "15.01 - 18.01.", "30.01 - 01.02."
 */
function parseSssDates(raw: string | null, year: number): { dateFrom: string | null; dateTo: string | null } {
  if (!raw) return { dateFrom: null, dateTo: null };

  // "15-18.01." — range within same month (no dot after first day)
  const sameMonthRange = raw.match(/(\d{1,2})-(\d{1,2})\.(\d{1,2})/);
  const allDmPairs = [...raw.matchAll(/(\d{1,2})\.(\d{1,2})/g)];

  if (sameMonthRange && allDmPairs.length <= 1) {
    const fromD = sameMonthRange[1].padStart(2, "0");
    const toD   = sameMonthRange[2].padStart(2, "0");
    const mo    = sameMonthRange[3].padStart(2, "0");
    return { dateFrom: `${year}-${mo}-${fromD}`, dateTo: `${year}-${mo}-${toD}` };
  }

  const toIso = (m: RegExpMatchArray) => `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const dateFrom = allDmPairs[0] ? toIso(allDmPairs[0]) : null;
  const dateTo   = allDmPairs[1] ? toIso(allDmPairs[1]) : null;
  return { dateFrom, dateTo };
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
    is10m: true,
    url: null,
    externalId: String(c.id),
    competitionTypeId: c.competitionType?.id,
    competitionTypeName: c.competitionType?.name,
    competitionTypeAcronym: c.competitionType?.acronym,
  }));
}

// ── ESC ───────────────────────────────────────────────────────────────────────

const ESC_BASE = "https://esc-shooting.org";

export async function fetchEscEvents(year: number): Promise<CalendarEvent[]> {
  // ESC shows one month at a time — fetch all 12 in parallel
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const results = await Promise.allSettled(
    months.map((month) =>
      fetch(
        `${ESC_BASE}/calendar?filter%5Bevent_year%5D=${year}&filter%5Bevent_month%5D=${month}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      ).then((r) => {
        if (!r.ok) throw new Error(`ESC fetch failed: ${r.status}`);
        return r.text();
      })
    )
  );

  const events: CalendarEvent[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const e of parseEscHtml(r.value)) {
      // Dedup by name+dateFrom (same event can appear in adjacent months)
      const key = `${e.name}|${e.dateFrom}`;
      if (!seen.has(key)) { seen.add(key); events.push(e); }
    }
  }
  return events;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEscHtml(html: string): CalendarEvent[] {
  // Columns: DATE | COMPETITION | EVENT | COUNTRY | CITY | RESULTS
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const events: CalendarEvent[] = [];
  let row;

  while ((row = rowRe.exec(html)) !== null) {
    const rawCells: string[] = [];
    const cellReLocal = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell;
    while ((cell = cellReLocal.exec(row[1])) !== null) {
      rawCells.push(cell[1]);
    }

    if (rawCells.length < 3) continue;
    const cells = rawCells.map(stripTags);
    if (cells[0] === "DATE") continue; // header row

    const dates = cells[0].match(/\d{2}\.\d{2}\.\d{4}/g) ?? [];
    const dateFrom = dates[0] ? escDateToIso(dates[0]) : null;
    const dateTo   = dates[1] ? escDateToIso(dates[1]) : null;

    const name      = cells[1];
    const eventType = cells[2] ?? "";
    const country   = cells[3]?.trim() || null;
    const city      = cells[4]?.trim() || null;

    if (!name || name.length < 3) continue;

    // Extract ESC event ID and URL from the link in the name cell
    const linkMatch = rawCells[1]?.match(/href="([^"]*calendar\/view\/(\d+)[^"]*)"/i);
    const escUrl    = linkMatch ? linkMatch[1] : null;
    const escId     = linkMatch ? linkMatch[2] : null;

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
      url: escUrl,
      externalId: escId,
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

export async function fetchAllCalendarEvents(
  year: number,
  sources: CalendarSource[] = ["sss", "issf", "esc"],
): Promise<CalendarEvent[]> {
  const fetchers: Promise<CalendarEvent[]>[] = [];
  if (sources.includes("sss"))  fetchers.push(fetchSssEvents(year));
  if (sources.includes("issf")) fetchers.push(fetchIssfEvents(year));
  if (sources.includes("esc"))  fetchers.push(fetchEscEvents(year));

  const results = await Promise.allSettled(fetchers);
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
