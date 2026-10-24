import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Poklapanje imena srpskih strelaca preko različitih zapisa istog imena.
 *
 * Isti strelac se u izvorima piše različito:
 *   - SSS bilten (PDF):  "Đorđe"  ili  "Djordje"  (đ → dj)
 *   - ISSF baza (ASCII): "Dorde"                   (đ → d, akcenti skinuti)
 *
 * Rešenje: svedi sve na jedinstven "fold" ključ (bez akcenata, đ/dj → d),
 * pa poredi. Za blizu-ali-ne-identično → fuzzy predlog koji admin potvrđuje.
 */

/** Svodi ime na kanonski ključ za poređenje. */
export function foldName(s: string): string {
  return s
    .normalize("NFD")                    // razdvoji akcente (č → c + kombinujući znak)
    .replace(/[\u0300-\u036f]/g, "")     // skini kombinujuće akcente
    .toLowerCase()
    .replace(/đ/g, "d")             // đ (U+0111) → d; ne dekomponuje se kroz NFD
    .replace(/dj/g, "d")                 // "dj" (transliteracija đ) → d
    .replace(/[^a-z]/g, "");             // ostavi samo slova
}

/**
 * Isti ključ kao foldName, izračunat u Postgres-u — za predfiltriranje kandidata u bazi
 * umesto učitavanja cele tabele. Mora ostati u skladu sa foldName (proveriti nad svim strelcima pri izmeni).
 */
export function foldNameSql(column: SQLWrapper): SQL<string> {
  return sql<string>`regexp_replace(replace(translate(lower(regexp_replace(normalize(${column}, NFD), '[̀-ͯ]', '', 'g')), 'Đđ', 'dd'), 'dj', 'd'), '[^a-z]', '', 'g')`;
}

/** Kanonski ključ celog imena (prezime + ime), redosled-nezavisan po delovima. */
export function nameKey(firstName: string, lastName: string): string {
  return `${foldName(lastName)}|${foldName(firstName)}`;
}

/** Levenshtein rastojanje (za fuzzy tier). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

export type MatchCandidate = {
  id: number;
  firstName: string;
  lastName: string;
  previousLastNames?: string[] | null;
  nationality?: string | null;
  /** Broj rezultata u bazi — razrešava dvosmislenu varijantu imena (aktivan strelac pre neaktivnog imenjaka). */
  resultCount?: number | null;
};

export type MatchResult =
  | { kind: "exact"; id: number }
  | { kind: "suggestion"; id: number; name: string }
  | { kind: "none" };

/**
 * Nađi poklapanje za strelca iz biltena među postojećima.
 * - exact:      isti fold-ključ (trenutno ili ranije prezime) + kompatibilna nacija → auto-poveži
 * - suggestion: isto prezime (fold), ime blizu (edit ≤ 2) → admin potvrđuje
 * - none:       novi strelac
 */
export function matchShooter(
  first: string,
  last: string,
  noc: string | null,
  existing: MatchCandidate[]
): MatchResult {
  const fLast = foldName(last);
  const fFirst = foldName(first);
  const nation = normalizeNoc(noc);
  const nocOk = (c: MatchCandidate) =>
    !c.nationality || !nation || normalizeNoc(c.nationality) === nation || nation === "SRB" || nation === "AIN";

  const lastMatches = (c: MatchCandidate) =>
    foldName(c.lastName) === fLast || !!c.previousLastNames?.some((p) => foldName(p) === fLast);

  // 1. Exact fold-ključ
  const exact = existing.find((c) => lastMatches(c) && foldName(c.firstName) === fFirst && nocOk(c));
  if (exact) return { kind: "exact", id: exact.id };

  // 2. Varijanta zapisa istog imena, ista država (ne SRB/AIN izuzetak): skraćeno ime ili prezime
  //    ("FIORI Peter" = "FIORI Peter Matthew", "VIDAL Daniel" = "VIDAL MOLINA Daniel Andres"),
  //    ß/ü transkripcija ("WEIß" = "WEISS", "BÜHLMEYER" = "BUEHLMEYER"), drugi redosled imena.
  //    Auto-poveži samo kad je kandidat jedinstven.
  const wLast = nameWords(last);
  const wFirst = nameWords(first);
  const variants = existing.filter((c) =>
    !!nation && normalizeNoc(c.nationality) === nation
    && [c.lastName, ...(c.previousLastNames ?? [])].some((l) => sameOrPrefix(nameWords(l), wLast))
    && sameOrPrefix(nameWords(c.firstName), wFirst));
  if (variants.length === 1) return { kind: "exact", id: variants[0].id };
  // "FIORI Peter" → Peter Matthew (puca) a ne Peter Louis (bez ijednog rezultata)
  const active = variants.filter((c) => (c.resultCount ?? 0) > 0);
  if (active.length === 1) return { kind: "exact", id: active[0].id };

  // 3. Fuzzy: isto prezime, ime blizu
  let best: { c: MatchCandidate; d: number } | null = null;
  for (const c of existing) {
    if (!lastMatches(c) || !nocOk(c)) continue;
    const d = editDistance(fFirst, foldName(c.firstName));
    if (d <= 2 && (!best || d < best.d)) best = { c, d };
  }
  if (best) return { kind: "suggestion", id: best.c.id, name: `${best.c.lastName} ${best.c.firstName}` };
  if (variants.length > 1) return { kind: "suggestion", id: variants[0].id, name: `${variants[0].lastName} ${variants[0].firstName}` };

  return { kind: "none" };
}

/** Regionalni timovi u rezultatima (SIUS: bavarski strelci kao "BAY") → država. */
const NOC_ALIASES: Record<string, string> = { BAY: "GER" };

export function normalizeNoc(noc: string | null | undefined): string | null {
  const code = noc?.trim().toUpperCase();
  return code ? NOC_ALIASES[code] ?? code : null;
}

/**
 * Reči imena za tolerantno poređenje: ß → ss, ł/ø/æ (NFD ih ne razlaže), nemačka transkripcija ae/oe/ue = ä/ö/ü.
 * Namerno odvojeno od foldName — foldNameSql indeksi u bazi moraju ostati isti.
 */
function nameWords(s: string): string[] {
  return s.replace(/ß/g, "ss").replace(/[łŁ]/g, "l").replace(/[øØ]/g, "o").replace(/[æÆ]/g, "ae").split(/[\s-]+/)
    .map((w) => foldName(w).replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u"))
    .filter(Boolean);
}

/** Iste reči (bilo kojim redom) ili je kraće ime početak dužeg, reč po reč ("ana" ≠ "anastasija"). */
function sameOrPrefix(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  if (a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ")) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every((w, i) => long[i] === w);
}
