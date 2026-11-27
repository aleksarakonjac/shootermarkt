/** Filteri pregleda rezultata takmičenja: puška/pištolj, uzrast, pol. */
import { CATEGORY_RANK, type AgeCategory } from "@shootermarkt/db/pdf-import-types";

export type Family = "rifle" | "pistol";
/** "X" = mešoviti timovi; null = open konkurencija (muškarci i žene zajedno). */
export type Gender = "M" | "F" | "X";
export type Facets = { family: Family; categories: AgeCategory[]; gender: Gender | null };
export type Filters = { family?: Family; category?: AgeCategory; gender?: Gender };

export function disciplineFamily(code: string): Family {
  return /^(AR|R3|RPR|STR|SOLOAR)/.test(code) ? "rifle" : "pistol";
}

export function matchesFilters(item: Facets, filters: Filters): boolean {
  return (!filters.family || item.family === filters.family)
    && (!filters.category || item.categories.includes(filters.category))
    // Open disciplina pripada i muškarcima i ženama, ali nije miks.
    && (!filters.gender || (item.gender === null ? filters.gender !== "X" : item.gender === filters.gender));
}

/** Samo vrednosti koje postoje u takmičenju; filter sa jednom vrednošću nema smisla, pa je prazan. */
export function filterOptions(items: Facets[]) {
  const pick = <T,>(values: T[], rank: (value: T) => number): T[] => {
    const unique = [...new Set(values)].sort((a, b) => rank(a) - rank(b));
    return unique.length > 1 ? unique : [];
  };
  return {
    family: pick(items.map((i) => i.family), (f) => ["rifle", "pistol"].indexOf(f)),
    category: pick(items.flatMap((i) => i.categories), (c) => -CATEGORY_RANK[c]), // stariji prvo
    gender: pick(items.flatMap((i) => (i.gender ? [i.gender] : [])), (g) => ["M", "F", "X"].indexOf(g)),
  };
}
