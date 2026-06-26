const SSS_BASE = "https://serbianshooting.rs";
const RESULTS_PAGE = `${SSS_BASE}/rezultati.htm`;
const CALENDAR_PAGE = `${SSS_BASE}/kalendar.htm`;

export interface SssBilten {
  url: string;        // absolute URL
  filename: string;   // e.g. "PS A 10m - BILTEN.pdf"
  year: number;
  is10m: boolean;
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

    bilteni.push({ url, filename, year, is10m, isExternal });
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

function parseCalendarHtml(html: string): SssCalendarEvent[] {
  // SSS calendar is a static HTML table — extract row text
  // Each row: date | competition name | location
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const events: SssCalendarEvent[] = [];

  let row;
  while ((row = rowPattern.exec(html)) !== null) {
    const rowHtml = row[1];
    const cells: string[] = [];
    let cell;
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    while ((cell = cellRe.exec(rowHtml)) !== null) {
      const text = cell[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&#\d+;/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (text) cells.push(text);
    }

    if (cells.length < 2) continue;

    // Guess which cell is date, name, location
    const dateCell = cells.find((c) => /\d{1,2}\.\d{1,2}\./.test(c));
    const nameCell = cells.find((c) => c !== dateCell && c.length > 3);
    const locationCell = cells.find((c) => c !== dateCell && c !== nameCell && c.length > 1);

    if (!nameCell) continue;

    const upper = nameCell.toUpperCase();
    const is10m = upper.includes("10M") || upper.includes("VAZDUŠN") || upper.includes("VAZDUSN");

    events.push({
      name: nameCell,
      date: dateCell ?? null,
      location: locationCell ?? null,
      is10m,
    });
  }

  return events.filter((e) => e.name.length > 3);
}
