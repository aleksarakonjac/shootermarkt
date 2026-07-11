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
  nationality?: string | null;
};

export type MatchResult =
  | { kind: "exact"; id: number }
  | { kind: "suggestion"; id: number; name: string }
  | { kind: "none" };

/**
 * Nađi poklapanje za strelca iz biltena među postojećima.
 * - exact:      isti fold-ključ + kompatibilna nacija → auto-poveži
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
  const nocOk = (c: MatchCandidate) =>
    !c.nationality || !noc || c.nationality === noc || noc === "SRB";

  // 1. Exact fold-ključ
  const exact = existing.find(
    (c) => foldName(c.lastName) === fLast && foldName(c.firstName) === fFirst && nocOk(c)
  );
  if (exact) return { kind: "exact", id: exact.id };

  // 2. Fuzzy: isto prezime, ime blizu
  let best: { c: MatchCandidate; d: number } | null = null;
  for (const c of existing) {
    if (foldName(c.lastName) !== fLast || !nocOk(c)) continue;
    const d = editDistance(fFirst, foldName(c.firstName));
    if (d <= 2 && (!best || d < best.d)) best = { c, d };
  }
  if (best) return { kind: "suggestion", id: best.c.id, name: `${best.c.lastName} ${best.c.firstName}` };

  return { kind: "none" };
}
