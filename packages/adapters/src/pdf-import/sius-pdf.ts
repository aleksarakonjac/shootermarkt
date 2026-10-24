import { getDocumentProxy } from "unpdf";
import { parseCategory, type AgeCategory, type ParsedBilten, type ParsedEvent, type ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { normalizeDisciplineCode } from "@shootermarkt/db/discipline";

/**
 * Deterministički parser SIUS biltena (digitalni PDF, ISSF format) — bez LLM-a.
 * Svaka lista u podnožju nosi ime SIUS fajla, npr. `Q100000IA1710261015.20.ARM.0.001.pdf`:
 *   Q = kvalifikacija, I/T = pojedinačno/ekipno, 20 = tip liste, ARM = disciplina.
 * Vraća null kad PDF nije SIUS bilten ili ima nešto što ne znamo da čitamo → Gemini fallback.
 */

type Item = { x: number; y: number; str: string };

const SIUS_FILE = /^([A-Z])\d+([IT])A(\d{2})(\d{2})(\d{2})\d{4}\.(\d+)\.([A-Z0-9]+)\.\d+\.\d+\.pdf$/;
// Kodovi tipa liste viđeni u SSS biltenima; nepoznat kod → kategorija iz podnaslova tabele.
const LIST_CODES: Record<string, { category: AgeCategory; guest?: boolean }> = {
  "1": { category: "senior" },   // "Qualification" — apsolutna lista
  "20": { category: "junior" },
  "10": { category: "senior", guest: true },
};
const REMARKS = /^(Q|DNS|DNF|DSQ|RPO|DN|S|F)$/;
const SCORE = /^(\d+(?:\.\d)?)(?:-\s*(\d+)x)?$/;

export async function parseSiusPdf(pdfBuffer: Buffer): Promise<ParsedBilten | null> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer), { verbosity: 0 });
  const pages: Item[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.flatMap((it) => ("str" in it && it.str.trim()
      ? [{ x: it.transform[4], y: it.transform[5], str: it.str.trim() }]
      : [])));
  }
  return parseSiusPages(pages);
}

export function parseSiusPages(pages: Item[][]): ParsedBilten | null {
  const events = new Map<string, ParsedEvent>();
  let sawSius = false;

  for (const items of pages) {
    const file = items.map((it) => SIUS_FILE.exec(it.str)).find(Boolean);
    if (!file) continue; // naslovna, protokol, službe…
    sawSius = true;
    const [, stage, kind, dd, mm, yy, listCode, discRaw] = file;
    if (kind === "T") continue; // ekipno — ignorišemo
    // ponytail: finala imaju više formata (eliminacija, kumulativ, R3P, SPW) — ceo bilten ide u Gemini dok ne dodamo SIUS finale
    if (stage !== "Q") return null;
    const discipline = normalizeDisciplineCode(discRaw);
    if (!discipline) continue;

    const list = LIST_CODES[listCode] ?? subtitleList(items);
    if (!list) return null;
    const key = file[0];
    let event = events.get(key);
    if (!event) {
      // naslov meča je red iznad "RESULTS"; datum iz imena fajla (DDMMYY)
      const results = items.find((it) => it.str === "RESULTS");
      const title = results && items.filter((it) => it.y > results.y).sort((a, b) => a.y - b.y)[0]?.str;
      event = {
        discipline, stage: "qualification", category: list.category, guest: list.guest, isInternational: false,
        eventName: title ?? null, eventDate: `20${yy}-${mm}-${dd}`, results: [],
      };
      events.set(key, event);
    }
    (event.results as ParsedShooterResult[]).push(...parseRows(items));
  }

  if (!sawSius) return null;
  // Rang lista ne štampa DNS/DNF (samo ekipna) — izvodi se iz broja serija na listi.
  for (const event of events.values()) {
    const rows = event.results as ParsedShooterResult[];
    const fullSeries = Math.max(...rows.map((r) => r.series.length));
    for (const r of rows) {
      if (r.remark) continue;
      if (r.total == null) r.remark = "DNS";
      else if (r.series.length < fullSeries) r.remark = "DNF";
    }
  }
  // Više dana/mečeva u jednom biltenu (npr. Kup + memorijal sutradan): najraniji je glavno
  // takmičenje (bez eventa), ostali postaju zasebni eventi istog takmičenja.
  const all = [...events.values()];
  const mainKey = all.map((e) => `${e.eventDate}|${e.eventName}`).sort()[0];
  for (const e of all) if (`${e.eventDate}|${e.eventName}` === mainKey) { e.eventName = null; e.eventDate = null; }
  return { events: all };
}

function subtitleList(items: Item[]) {
  const sub = items.find((it) => /junior|kadet|cadet|pionir|senior|qualification|guest|gost|\bu-?\d\d\b/i.test(it.str));
  if (!sub) return null;
  return /guest|gost/i.test(sub.str) ? { category: "senior" as const, guest: true } : { category: parseCategory(sub.str) };
}

function parseRows(items: Item[]): ParsedShooterResult[] {
  const header = (label: string) => items.find((it) => it.str === label);
  const rank = header("Rank");
  const name = header("Name");
  const noc = header("NOC") ?? header("NOC/Team");
  if (!rank || !name || !noc) return [];
  const team = items.find((it) => it.str === "Team" && Math.abs(it.y - rank.y) < 3);
  const firstSeries = items.find((it) => it.str === "1" && it.y < rank.y && it.y > rank.y - 15 && it.x > noc.x);
  const scoresX = (firstSeries?.x ?? 340) - 20;
  const bib = header("Bib No")!;
  const fp = items.find((it) => it.str === "FP" && Math.abs(it.y - rank.y) < 3);
  const end = items.find((it) => it.str === "Summary")?.y ?? items.find((it) => it.str.startsWith("Version of"))?.y ?? 0;

  const body = items.filter((it) => it.y < rank.y - 12 && it.y > end + 5);
  const anchors = body
    .filter((it) => it.x >= name.x - 5 && it.x < noc.x - 5 && /^[A-ZČĆŽŠĐ'-]{2,}( [A-ZČĆŽŠĐ'-]+)* \S/.test(it.str))
    .sort((a, b) => b.y - a.y);

  return anchors.map((anchor, i) => {
    const nextY = anchors[i + 1]?.y ?? -Infinity;
    const line = body.filter((it) => Math.abs(it.y - anchor.y) <= 3);
    // nastavak u sledećem redu: prelomljen naziv kluba ("SMEDEREV" / "O"), remark ("DN" / "S")
    const wrap = body.filter((it) => it.y < anchor.y - 3 && it.y > Math.max(nextY + 3, anchor.y - 14));
    const col = (from: number, to: number, src = line) => src.filter((it) => it.x >= from && it.x < to).sort((a, b) => a.x - b.x);

    const rankStr = col(0, (fp ?? bib).x - 5)[0]?.str;
    const bibStr = col(bib.x - 5, name.x - 5)[0]?.str;
    const clubTo = team && team.x > noc.x ? team.x - 5 : scoresX;
    const club = joinWrapped(col(noc.x - 5, clubTo).map((it) => it.str).join(" "), col(noc.x - 5, clubTo, wrap).map((it) => it.str).join(" "));

    const right = col(scoresX, Infinity);
    const scores = right.map((it) => SCORE.exec(it.str)).filter((m): m is RegExpExecArray => !!m);
    const remarks = [...right, ...col(scoresX, Infinity, wrap)].map((it) => it.str).filter((s) => REMARKS.test(s));
    const remark = remarks.filter((r) => r !== "Q").join("") || null;
    const total = scores.at(-1);

    // gosti: "SVETKAVITSA - BUL" → klub + država
    const country = /^(.*?)\s*-\s*([A-Z]{3})$/.exec(club);
    const { firstName, lastName } = splitName(anchor.str);
    return {
      rank: rankStr && /^\d+$/.test(rankStr) ? Number(rankStr) : null,
      bibNumber: bibStr && /^\d+$/.test(bibStr) ? Number(bibStr) : undefined,
      lastName,
      firstName,
      teamNoc: country ? country[2] : "SRB",
      clubName: (country ? country[1] : club) || undefined,
      birthYear: null,
      series: scores.slice(0, -1).map((m) => Number(m[1])),
      total: total ? Number(total[1]) : null,
      inners: total?.[2] ? Number(total[2]) : null,
      qualified: remarks.includes("Q") ? true : null,
      remark,
    };
  });
}

/** Prelom unutar reči ("SMEDERE" + "VO") nema razmak; prelom između reči ("NOVI SAD" + "1790") ima. */
function joinWrapped(first: string, rest: string) {
  if (!rest) return first;
  return rest.length <= 2 && /[A-Z]$/.test(first) && /^[A-Z]/.test(rest) ? first + rest : `${first} ${rest}`;
}

/** "JOVANOVIC Stevan" → prezime su vodeće reči velikim slovima. */
function splitName(full: string) {
  const words = full.split(/\s+/);
  const firstLower = words.findIndex((w) => w !== w.toUpperCase());
  const cut = firstLower === -1 ? words.length - 1 : firstLower;
  const title = (w: string) => w.toLowerCase().replace(/(^|[-' ])\p{L}/gu, (c) => c.toUpperCase());
  return { lastName: title(words.slice(0, cut).join(" ")), firstName: words.slice(cut).join(" ") };
}
