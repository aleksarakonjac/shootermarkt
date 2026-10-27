const en = new Intl.DisplayNames("en", { type: "region" });
const sr = new Intl.DisplayNames("sr-Latn", { type: "region" });

/** Lowercase + bez dijakritika (đ → dj), da "madjarska" nađe "Mađarska". */
export function foldSearch(s: string): string {
  return s.toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function countryNames(alpha2: string | null | undefined): string[] {
  if (!alpha2 || alpha2.length !== 2) return [];
  try { return [en.of(alpha2.toUpperCase()), sr.of(alpha2.toUpperCase())].filter((x): x is string => !!x); } catch { return []; }
}

/** Dodatni termini za pretragu države: srpski + engleski naziv (Intl) i prosleđena imena/kodovi. */
export function countryKeywords(alpha2: string | null | undefined, ...extra: (string | null | undefined)[]): string {
  return [...extra, ...countryNames(alpha2)].filter(Boolean).join(" ");
}
