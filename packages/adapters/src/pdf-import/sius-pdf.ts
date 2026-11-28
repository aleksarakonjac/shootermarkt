import { getDocumentProxy } from "unpdf";
import { isUnrankedRemark, matchEventName, parseCategory, type AgeCategory, type MixedTeamEntry, type ParsedBilten, type ParsedEvent, type ParsedFinalResult, type ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { normalizeDisciplineCode } from "@shootermarkt/db/discipline";
import { glyphFixes } from "./sius-fonts";
import { clubNation, scoreText, SCORE, topmost, type Item } from "./sius-layout";
import { splitName } from "./sius-names";
import { parseMixedTeams, type TeamPage } from "./sius-teams";
import { parseClubTeams, type ClubTeamPage } from "./sius-club-teams";

export { splitGuessedName } from "./sius-names";

/**
 * Deterministički parser SIUS biltena (digitalni PDF, ISSF format, domaći i međunarodni) — bez LLM-a.
 * Svaka lista u podnožju nosi ime SIUS fajla, npr. `Q100000IA1710261015.20.ARM.0.001.pdf`:
 *   Q = kvalifikacija, I/T = pojedinačno/ekipno, 20 = tip liste, ARM = disciplina.
 * Vraća null kad PDF nije SIUS bilten ili ima nešto što ne znamo da čitamo → Gemini fallback.
 * Od finala čita 10m vazdušna (F stranice); ostala, i ona koja ne prođu proveru, samo prijavljuje (hasFinals).
 * Od ekipnih lista čita samo mešovite timove (ARMT/APMT).
 */

const SIUS_FILE = /^([A-Z])\d+([IT])A(\d{2})(\d{2})(\d{2})\d{4}\.(\d+)\.([A-Z0-9]+)\.\d+\.\d+\.pdf$/;
// Kodovi tipa liste viđeni u SSS biltenima; nepoznat kod → kategorija iz podnaslova tabele.
const LIST_CODES: Record<string, { category: AgeCategory; guest?: boolean }> = {
  "1": { category: "senior" },   // "Qualification" — apsolutna lista
  "20": { category: "junior" },
  "10": { category: "senior", guest: true },
};
const REMARKS = /^(Q|DNS|DNF|DSQ|RPO|DN|S|F)$/;
const AIR = /^(AR|AP)[MW]$/;
const DECIMAL = /^\d+(?:\.\d)?$/;

/** Tekst svake strane sa koordinatama, sa vraćenim slovima (vidi sius-fonts.ts). */
export async function extractSiusPages(pdfBuffer: Buffer): Promise<Item[][]> {
  // fontExtraProperties: glyphFixes čita tabele fonta
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer), { verbosity: 0, fontExtraProperties: true });
  const pages: Item[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const fixes = await glyphFixes(page);
    const content = await page.getTextContent({ disableNormalization: true });
    pages.push(content.items.flatMap((it) => {
      if (!("str" in it)) return [];
      const fix = fixes.get(it.fontName);
      const str = (fix ? Array.from(it.str, (c) => fix.get(c) ?? c).join("") : it.str).trim();
      return str ? [{ x: it.transform[4], y: it.transform[5], str }] : [];
    }));
  }
  return pages;
}

export async function parseSiusPdf(pdfBuffer: Buffer): Promise<ParsedBilten | null> {
  return parseSiusPages(await extractSiusPages(pdfBuffer));
}

export function parseSiusPages(pages: Item[][]): ParsedBilten | null {
  const events = new Map<string, ParsedEvent>();
  let sawSius = false;
  let hasFinals = false;
  const teamPages: TeamPage[] = [];
  const clubPages: ClubPage[] = [];
  const clubCategories = new Map<string, AgeCategory>();
  const clubWarnings: string[] = [];
  /** Najstarija grupa ("U16"…"U21") na ekipnoj listi po fajlu, i najstarije godište miks lista po disciplini. */
  const oldestGroup = new Map<string, number>();
  const oldestBorn = new Map<string, number>();

  for (const items of pages) {
    const file = items.map((it) => SIUS_FILE.exec(it.str)).find(Boolean);
    if (!file) continue; // naslovna, protokol, službe…
    sawSius = true;
    const [, stage, kind, dd, mm, yy, listCode, discRaw] = file;
    // sufiksi u kodu vazdušnih: "J" = juniorska lista (ARMJ, ARMTJ), broj = ponovljeni meč (ARM2 je drugi dan)
    const [, airCode, juniorCode] = /^(A[RP](?:[MW]|MT))(J?)\d?$/.exec(discRaw) ?? [];
    const discipline = normalizeDisciplineCode(airCode ?? discRaw);
    if (kind === "T") {
      const date = `20${yy}-${mm}-${dd}`;
      if (discipline === "ARMT" || discipline === "APMT") {
        const age = items.find((it) => /kadet|cadet|pionir|\bu-?\d\d\b/i.test(it.str));
        const category = juniorCode || listCode === "20" || items.some((it) => it.str === "Junior") ? "junior" as const : parseCategory(age?.str);
        for (const it of items) {
          const born = Number(/^\d+(?:\.\d)?(?:-\s*\d+x)?\s+((?:19|20)\d\d)$/.exec(it.str)?.[1]);
          // starost u godini takmičenja
          if (born) oldestBorn.set(discipline, Math.max(oldestBorn.get(discipline) ?? 0, Number(`20${yy}`) - born));
        }
        if (stage === "Q" || stage === "F") teamPages.push({ discipline, isFinal: stage === "F", category, date, items });
      } else if (discipline && (stage === "Q" || (stage === "I" && items.some((it) => it.str === "RESULTS")))) {
        // klupske ekipe pojedinačne discipline; podnaslov kategorije stoji samo na prvoj strani liste
        if (items.some((it) => it.str === "Group")) {
          for (const it of items) {
            const group = Number(/^U(\d\d)$/.exec(it.str)?.[1]);
            if (group) oldestGroup.set(file[0], Math.max(oldestGroup.get(file[0]) ?? 0, group));
          }
        }
        const category = clubCategories.get(file[0]) ?? (juniorCode ? "junior" as const
          : LIST_CODES[listCode]?.category ?? subtitleList(items)?.category ?? (items.some((it) => it.str === discRaw) ? "senior" as const : undefined));
        if (!category) { clubWarnings.push(`Ekipe ${discipline}: nepoznata kategorija liste (${date})`); continue; }
        clubCategories.set(file[0], category);
        clubPages.push({ file: file[0], discipline, category, date, title: listTitle(items), items });
      }
      continue;
    }
    // ponytail: ostala finala imaju svoje formate (R3P, SPW, RFPM) — čita ih pozivalac drugim putem
    const finalRows = stage === "F" && discipline && AIR.test(discipline) ? parseAirFinalRows(items) : null;
    // "I" sa naslovom RESULTS je pojedinačna lista bez kvalifikacija/finala (međunarodni bilteni)
    const isQual = stage === "Q" || (stage === "I" && items.some((it) => it.str === "RESULTS"));
    if (!isQual && !finalRows) { hasFinals = true; continue; }
    if (!discipline) continue;

    const key = file[0];
    let event = events.get(key);
    if (!event) {
      // podnaslov stoji samo na prvoj strani liste; apsolutna međunarodna: sam kod discipline ("ARM") ili "Individual"
      const absolute = finalRows || items.some((it) => it.str === discRaw || it.str === "Individual");
      // tip liste "1" ne razlikuje uzrast, pa J iz koda discipline ima prednost
      const list = juniorCode ? { category: "junior" as const, guest: LIST_CODES[listCode]?.guest }
        : LIST_CODES[listCode] ?? subtitleList(items) ?? (absolute ? { category: "senior" as const } : null);
      if (!list) return null;
      // datum iz imena fajla (DDMMYY)
      const title = listTitle(items);
      event = {
        discipline, stage: finalRows ? "final" : "qualification", category: list.category, guest: list.guest, isInternational: false,
        eventName: title ?? null, eventDate: `20${yy}-${mm}-${dd}`, results: [],
      };
      events.set(key, event);
    }
    if (finalRows) (event.results as ParsedFinalResult[]).push(...finalRows);
    else (event.results as ParsedShooterResult[]).push(...parseRows(items));
  }

  if (!sawSius) return null;
  // Rang lista ne štampa DNS/DNF (samo ekipna) — izvodi se iz broja serija na listi.
  const all = [...events.values()];
  const quals = all.filter((e) => e.stage === "qualification");
  for (const event of quals) {
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
  const matchKey = (e: ParsedEvent) => `${e.eventDate}|${e.eventName}`;
  // Finale pripada meču svoje kvalifikacije; ako disciplina ima samo jedan meč, i kad mu naslov ili datum odstupaju.
  const ownQual = new Map(all.filter((e) => e.stage === "final").map((final) => {
    const same = quals.filter((e) => e.discipline === final.discipline);
    return [final, same.find((e) => matchKey(e) === matchKey(final)) ?? (new Set(same.map(matchKey)).size === 1 ? same[0] : undefined)];
  }));
  // Više dana/mečeva u jednom biltenu (npr. Kup + memorijal sutradan): liste sa naslovom najranije su glavno
  // takmičenje (bez eventa) i kad traje više dana; drugi naslov, ili ista lista ponovljena drugog dana, je zaseban event.
  const byDate = [...(quals.length ? quals : all)].sort((a, b) => matchKey(a).localeCompare(matchKey(b)));
  const mainTitle = byDate[0]?.eventName;
  const taken = new Set<string>();
  const slotOf = (e: ParsedEvent) => `${e.discipline}|${e.category}|${e.guest}`;
  const main = new Set(byDate.filter((e) => {
    const slot = slotOf(e);
    if (e.eventName !== mainTitle || taken.has(slot)) return false;
    taken.add(slot);
    return true;
  }));
  const isMain = new Map(all.map((e) => [e, main.has(ownQual.get(e) ?? e)]));
  // Naslov isti kao glavni nije ime ponovljenog meča — dobija redni broj i datum.
  const repeats = new Map<string, number>();
  for (const e of byDate) {
    if (e.eventName !== mainTitle) continue;
    const n = (repeats.get(slotOf(e)) ?? 0) + 1;
    repeats.set(slotOf(e), n);
    if (n > 1) e.eventName = matchEventName(n, e.eventDate!);
  }
  for (const [final, own] of ownQual) if (own) { final.eventName = own.eventName; final.eventDate = own.eventDate; }
  const shotOn = new Map(all.map((e) => [e, e.eventDate]));
  for (const e of all) if (isMain.get(e)) { e.eventName = null; e.eventDate = null; }
  // ekipa ide u meč svoje pojedinačne liste; bez nje: najraniji dan je glavni meč, ostali zasebni
  const firstDate = [...shotOn.values(), ...clubPages.map((p) => p.date)].sort()[0];
  const clubs = parseClubTeams(clubPages.map(({ file, title, date, ...listed }) => {
    // ekipa od više uzrasta takmiči se u najstarijem navedenom
    const group = oldestGroup.get(file);
    const page = group ? { ...listed, category: parseCategory(`U${group}`) } : listed;
    const same = quals.filter((e) => !e.guest && e.discipline === page.discipline && e.category === page.category);
    // kao kod finala: kad disciplina ima samo jedan meč, ekipna lista mu pripada i sa drugim datumom
    const own = same.find((e) => shotOn.get(e) === date) ?? (same.length === 1 ? same[0] : undefined);
    const match = own ? { eventName: own.eventName ?? null, eventDate: own.eventDate ?? date }
      : { eventName: date === firstDate ? null : title && title !== mainTitle ? title : matchEventName(2, date), eventDate: date };
    return { ...page, ...match };
  }));
  // omladinski miks nema "Junior" u naslovu: svi do 20 godina po godištima → juniorski (i finale, bez godišta)
  for (const page of teamPages) if (page.category === "senior" && (oldestBorn.get(page.discipline) ?? 99) <= 20) page.category = "junior";
  const mixed = parseMixedTeams(teamPages, quals.flatMap((e) => e.results as ParsedShooterResult[]));
  useFinalNameSplit(all, mixed.entries);
  const warnings = [...mixed.warnings, ...clubWarnings, ...clubs.warnings];
  return {
    events: all, hasFinals, mainDate: firstDate ?? undefined,
    ...(mixed.entries.length ? { mixedTeams: mixed.entries } : {}),
    ...(clubs.entries.length ? { teamResults: clubs.entries } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}

/** Finala pišu prezime velikim slovima, pa su pouzdan izvor za podelu imena kad ga lista piše "Prezime Ime". */
function useFinalNameSplit(events: ParsedEvent[], teams: MixedTeamEntry[]) {
  const full = (r: { firstName: string; lastName: string }) => `${r.lastName} ${r.firstName}`.toLowerCase();
  const split = new Map(events.filter((e) => e.stage === "final")
    .flatMap((e) => (e.results as ParsedFinalResult[]).map((r) => [full(r), r] as const)));
  for (const e of events) if (e.stage === "qualification") for (const r of e.results as ParsedShooterResult[]) {
    const final = split.get(full(r));
    if (final) Object.assign(r, { firstName: final.firstName, lastName: final.lastName, fullName: undefined });
  }
  for (const t of teams) {
    const m = split.get(`${t.mLastName} ${t.mFirstName}`.toLowerCase()), f = split.get(`${t.fLastName} ${t.fFirstName}`.toLowerCase());
    if (m) Object.assign(t, { mFirstName: m.firstName, mLastName: m.lastName, mFullName: undefined });
    if (f) Object.assign(t, { fFirstName: f.firstName, fLastName: f.lastName, fFullName: undefined });
  }
}

type ClubPage = { file: string; discipline: ClubTeamPage["discipline"]; category: AgeCategory; date: string; title: string | undefined; items: Item[] };

/** Naslov meča je red iznad "RESULTS" / "FINAL RESULTS". */
function listTitle(items: Item[]) {
  const results = items.find((it) => it.str === "RESULTS" || it.str === "FINAL RESULTS");
  return results && items.filter((it) => it.y > results.y).sort((a, b) => a.y - b.y)[0]?.str;
}

function subtitleList(items: Item[]) {
  const sub = items.find((it) => /junior|kadet|cadet|pionir|senior|qualification|guest|gost|\bu-?\d\d\b/i.test(it.str));
  if (!sub) return null;
  return /guest|gost/i.test(sub.str) ? { category: "senior" as const, guest: true } : { category: parseCategory(sub.str) };
}

function parseRows(items: Item[]): ParsedShooterResult[] {
  const header = topmost(items);
  const rank = header("Rank");
  const name = header("Name");
  const noc = header("NOC") ?? header("NOC/Team") ?? header("Nation") ?? header("Nation/Team");
  if (!rank || !name || !noc) return [];
  const team = items.find((it) => it.str === "Team" && Math.abs(it.y - rank.y) < 3);
  const firstSeries = items.find((it) => it.str === "1" && it.y < rank.y && it.y > rank.y - 15 && it.x > noc.x);
  const scoresX = (firstSeries?.x ?? 340) - 20;
  const bib = header("Bib No")!;
  const fp = items.find((it) => it.str === "FP" && Math.abs(it.y - rank.y) < 3);
  // "NOC / Code" je zasebna kolona sa državom, a "Team" tada nosi klub (omladinski kup)
  const code = header("Code");
  const codeColumn = !!code && !!team && Math.abs(code.x - noc.x) < 4 && team.x > noc.x;
  const end = items.find((it) => it.str === "Summary")?.y ?? items.find((it) => it.str.startsWith("Version of"))?.y ?? 0;

  const body = items.filter((it) => it.y < rank.y - 12 && it.y > end + 5);
  const inName = (it: Item) => it.x >= name.x - 5 && it.x < noc.x - 5;
  const anchors = body
    // red počinje imenom koje ima startni broj u istom redu: "ZIVKOVIC Andrija" ili "Gorša Petar";
    // dugo ime se prelama pa u prvom redu ostane samo prezime
    .filter((it) => inName(it) && /^\p{Lu}/u.test(it.str)
      && (/ \S/.test(it.str) || body.some((next) => inName(next) && next.y < it.y - 3 && next.y > it.y - 14))
      && body.some((b) => b.x >= bib.x - 5 && b.x < name.x - 5 && Math.abs(b.y - it.y) <= 3 && /^\d+$/.test(b.str)))
    .sort((a, b) => b.y - a.y);

  return anchors.map((anchor, i) => {
    const nextY = anchors[i + 1]?.y ?? -Infinity;
    const line = body.filter((it) => Math.abs(it.y - anchor.y) <= 3);
    // nastavak u sledećem redu: prelomljen naziv kluba ("SMEDEREV" / "O"), remark ("DN" / "S")
    const wrap = body.filter((it) => it.y < anchor.y - 3 && it.y > Math.max(nextY + 3, anchor.y - 14));
    const col = (from: number, to: number, src = line) => src.filter((it) => it.x >= from && it.x < to).sort((a, b) => a.x - b.x);

    const rankStr = col(0, (fp ?? bib).x - 5)[0]?.str;
    const bibStr = col(bib.x - 5, name.x - 5)[0]?.str;
    const text = (from: number, to: number) => joinWrapped(col(from, to).map((it) => it.str).join(" "), col(from, to, wrap).map((it) => it.str).join(" "));
    const clubTo = team && team.x > noc.x ? team.x - 5 : scoresX;
    const stated = codeColumn ? col(noc.x - 5, team!.x - 5)[0]?.str : undefined;
    // za strance se od naziva tima ne pravi klub u bazi
    const nation = stated ? { teamNoc: stated, clubName: stated === "SRB" ? text(team!.x - 5, scoresX) || undefined : undefined } : clubNation(text(noc.x - 5, clubTo));

    const right = col(scoresX, Infinity);
    const scored = right.filter((it) => SCORE.test(scoreText(it.str)));
    const scores = scored.map((it) => SCORE.exec(scoreText(it.str))!);
    // godište uz zbir; u uskoj koloni se prelama ("20" uz zbir, "11" red niže)
    const [, year] = /\s((?:19|20)(?:\d\d)?)$/.exec(scored.at(-1)?.str ?? "") ?? [];
    const rest = year?.length === 2 ? col(scoresX, Infinity, wrap).find((it) => /^\d\d$/.test(it.str))?.str : "";
    const birthYear = year && rest !== undefined ? Number(year + rest) : null;
    const remarks = [...right, ...col(scoresX, Infinity, wrap)].map((it) => it.str).filter((s) => REMARKS.test(s));
    const remark = remarks.filter((r) => r !== "Q").join("") || null;
    const total = scores.at(-1);

    return {
      rank: rankStr && /^\d+$/.test(rankStr) ? Number(rankStr) : null,
      bibNumber: bibStr && /^\d+$/.test(bibStr) ? Number(bibStr) : undefined,
      ...splitName([anchor, ...col(name.x - 5, noc.x - 5, wrap)].map((it) => it.str).join(" ")),
      ...nation,
      birthYear,
      series: scores.slice(0, -1).map((m) => Number(m[1])),
      total: total ? Number(total[1]) : null,
      inners: total?.[2] ? Number(total[2]) : null,
      qualified: remarks.includes("Q") ? true : null,
      remark,
    };
  });
}

/**
 * Finale 10m: prvi red finaliste nosi plasman, prezime i zbir posle svake serije (poslednji je ukupan),
 * ispod su pojedinačni hici. Vraća null ako se hici ne slažu sa zbirom ili plasmani nisu 1…n.
 */
function parseAirFinalRows(items: Item[]): ParsedFinalResult[] | null {
  const header = topmost(items);
  const [rank, name, noc, remarks] = ["Rk", "Name", "NOC", "Remarks"].map(header);
  const stage = header("Stage 1") ?? header("1st Comp."); // domaći / međunarodni naziv prve kolone zbirova
  if (!rank || !name || !noc || !stage || !remarks) return null;
  const end = header("Legend")?.y ?? items.find((it) => it.str.startsWith("Version of"))?.y ?? 0;
  const body = items.filter((it) => it.y < rank.y - 3 && it.y > end + 3);
  const anchors = body.filter((it) => it.x < rank.x + 12 && /^\d+$/.test(it.str)).sort((a, b) => b.y - a.y);
  // zbirovi i hici počinju levo od zaglavlja prve kolone, u širem finalu i za više od 10 pt
  const scoresX = stage.x - 20;

  const rows: ParsedFinalResult[] = [];
  for (const [i, anchor] of anchors.entries()) {
    const nextY = anchors[i + 1]?.y ?? -Infinity;
    const block = body.filter((it) => it.y <= anchor.y + 3 && it.y > nextY + 3);
    const col = (from: number, to: number) => block.filter((it) => it.x >= from && it.x < to).sort((a, b) => b.y - a.y || a.x - b.x);
    const scores = col(scoresX, remarks.x - 5).filter((it) => DECIMAL.test(it.str));
    const onFirstLine = (it: Item) => Math.abs(it.y - anchor.y) <= 3;
    const cumulative = scores.filter(onFirstLine).sort((a, b) => a.x - b.x).map((it) => Number(it.str));
    const shotSum = scores.filter((it) => !onFirstLine(it)).reduce((sum, it) => sum + Number(it.str), 0);
    const total = cumulative.at(-1) ?? null;
    const remark = col(remarks.x - 5, Infinity).map((it) => it.str).join(" ") || null;
    const fullName = col(name.x - 5, noc.x - 10).map((it) => it.str).join(" ");

    const verified = total == null ? isUnrankedRemark(remark) : Math.abs(shotSum - total) < 0.05;
    if (Number(anchor.str) !== i + 1 || !fullName || !verified) return null;

    const nation = clubNation(col(noc.x - 10, scoresX).map((it) => it.str).join(" "));
    rows.push({
      rank: i + 1,
      ...splitName(fullName),
      ...nation,
      total,
      cumulative: total == null ? null : cumulative,
      // S1, S2 (po 5 hitaca), pa parovi 11–12, 13–14… — isti nazivi kao u lib/final-detail.ts
      seriesLabels: total == null ? null : cumulative.map((_, n) => (n < 2 ? `S${n + 1}` : `${7 + 2 * n}–${8 + 2 * n}`)),
      remark,
    });
  }
  return rows.length ? rows : null;
}

/** Prelom unutar reči ("SMEDERE" + "VO") nema razmak; prelom između reči ("NOVI SAD" + "1790") ima. */
function joinWrapped(first: string, rest: string) {
  if (!rest) return first;
  return rest.length <= 2 && /[A-Z]$/.test(first) && /^[A-Z]/.test(rest) ? first + rest : `${first} ${rest}`;
}
