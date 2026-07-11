import { getSssCompetitionTags, type SssCompetitionTag } from "./competition-tags";

const SSS_BASE = "https://serbianshooting.rs";
const RESULTS_PAGE = `${SSS_BASE}/rezultati.htm`;
const CALENDAR_PAGE = `${SSS_BASE}/kalendar.htm`;

export interface SssBilten {
  url: string;        // absolute URL
  filename: string;   // e.g. "PS A 10m - BILTEN.pdf"
  year: number;
  is10m: boolean;
  tags: SssCompetitionTag[];
  isExternal: boolean; // hosted externally (ISSF, ESC, etc.)
}

export interface SssCalendarEvent {
  name: string;
  date: string | null;
  location: string | null;
  is10m: boolean;
}

/** Fetch list of bilteni from serbianshooting.rs/rezultati.htm */
export async function fetchSssBilteni(): Promise<SssBilten[]> {
  const res = await fetch(RESULTS_PAGE, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SSS rezultati fetch failed: ${res.status}`);
  // Site uses Windows-1252 / latin-1
  const buf = await res.arrayBuffer();
  const html = new TextDecoder("windows-1252").decode(buf);
  return parseBilteniHtml(html);
}

function parseBilteniHtml(html: string): SssBilten[] {
  const pdfPattern = /href="([^"]+\.pdf)"/gi;
  const bilteni: SssBilten[] = [];
  const seen = new Set<string>();
  let m;

  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);

    const isExternal = href.startsWith("http");
    const url = isExternal ? href : `${SSS_BASE}/${href}`;

    // Extract filename from URL
    const rawName = decodeURIComponent(href.split("/").pop() ?? href);
    const filename = rawName.replace(/\.pdf$/i, "");

    // Infer year from path segment like "2026/..."
    const yearMatch = href.match(/^(\d{4})\//);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

    // Is it a 10m event?
    const upper = filename.toUpperCase();
    const has10m = upper.includes("10M");
    const hasMk50 = upper.includes("25-50") || upper.includes("50M") || upper.includes("25M");
    const is10m = has10m && !hasMk50;
    const tags = getSssCompetitionTags(filename);

    bilteni.push({ url, filename, year, is10m, tags, isExternal });
  }

  return bilteni;
}

/** Fetch calendar from serbianshooting.rs/kalendar.htm */
export async function fetchSssCalendar(): Promise<SssCalendarEvent[]> {
  const res = await fetch(CALENDAR_PAGE, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SSS kalendar fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const html = new TextDecoder("windows-1252").decode(buf);
  return parseCalendarHtml(html);
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCalendarHtml(html: string): SssCalendarEvent[] {
  // SSS table columns: date | name+location (same td, name=bold, location=p after bold) | Info (skip)
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const events: SssCalendarEvent[] = [];

  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const rowHtml = row[1];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const rawCells: string[] = [];
    let cell;
    while ((cell = cellRe.exec(rowHtml)) !== null) rawCells.push(cell[1]);

    if (rawCells.length < 2) continue;

    // Col 0: date
    const dateText = stripTags(rawCells[0]);
    if (!/\d{1,2}\.\d{1,2}/.test(dateText)) continue;

    // Col 1: name (bold) + location (non-bold <p> after bold)
    const nameCell = rawCells[1];

    // Extract bold segments → name
    const boldMatches = [...nameCell.matchAll(/<b[^>]*>([\s\S]*?)<\/b>/gi)];
    const name = boldMatches.map((m) => stripTags(m[1])).join(" / ").replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) continue;

    // Extract non-bold text segments after removing bold blocks → location
    // SSS uses unclosed <p> tags (closed by </td>), so match up to </p> OR </td>
    const withoutBold = nameCell.replace(/<b[^>]*>[\s\S]*?<\/b>/gi, "");
    const pMatches = [...withoutBold.matchAll(/<p[^>]*>([\s\S]*?)(?:<\/p>|$)/gi)];
    const location = pMatches
      .map((m) => stripTags(m[1]))
      .filter((t) => t.length > 1)
      .join(", ") || null;

    const upper = name.toUpperCase();
    const is10m = upper.includes("10M") || upper.includes("VAZDUŠN") || upper.includes("VAZDUSN");

    events.push({ name, date: dateText, location, is10m });
  }

  return events.filter((e) => e.name.length > 3);
}
