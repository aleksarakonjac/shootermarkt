/**
 * Prioritet takmičenja za "Aktuelno / In focus" sekciju.
 * MANJI broj = VAŽNIJE (0 = olimpijske igre). `competitions.focus_priority`
 * je ručni override; kad je NULL koristi se `defaultFocusPriority`.
 *
 * Podrazumevana vrednost = baza po nivou/tipu događaja
 *                        + pomak za starosnu kategoriju (senior → pionir)
 *                        + pomak za 300m (manje važno od 10/25/50m).
 * Takmičenja koja se ne mogu izvesti iz tih podataka (npr. Mediteranske igre,
 * European Youth League finale) postavljaju se ručno prema legendi.
 */

export const FOCUS_PRIORITY_TIERS: ReadonlyArray<{ value: number; label: string; examples: string }> = [
  { value: 0,  label: "Olimpijske igre",                          examples: "Olimpijske igre" },
  { value: 1,  label: "Svetsko prvenstvo (senior)",               examples: "ISSF World Championship 10/25/50m" },
  { value: 2,  label: "Svetski kup",                              examples: "ISSF World Cup, Finale svetskog kupa" },
  { value: 3,  label: "Evropsko prvenstvo (senior)",              examples: "European Championship 10/25/50m" },
  { value: 4,  label: "Velike multi-sport i kontinentalne igre",  examples: "Mediteranske igre, Evropske igre, Univerzijada" },
  { value: 5,  label: "Ostala kontinentalna takmičenja",          examples: "European Youth League, Evropski kup, Grand Prix" },
  { value: 6,  label: "Velika međunarodna takmičenja",            examples: "Champions League, Grand Prix, jaki međunarodni kupovi" },
  { value: 7,  label: "Međunarodna takmičenja",                   examples: "Međunarodni mitinzi, memorijali" },
  { value: 8,  label: "Državna takmičenja",                       examples: "Prvenstvo Srbije, Kup Srbije" },
  { value: 9,  label: "Regionalna takmičenja",                    examples: "Regionalno prvenstvo, liga" },
  { value: 10, label: "Klupska takmičenja",                       examples: "Klupski turniri, prijateljski mečevi" },
];

export const FOCUS_PRIORITY_MIN = 0;
export const FOCUS_PRIORITY_MAX = 20;

/** Pomak po starosnoj kategoriji (dodaje se na bazu): senior 0 → pionir +5. */
export const FOCUS_AGE_OFFSET: Record<string, number> = {
  senior: 0, mladji_senior: 0, open: 0, master: 0,
  junior: 2, mladji_junior: 3, kadet: 4, pionir: 5,
};

/** 300m je manje važno od 10/25/50m. */
export const FOCUS_300M_OFFSET = 4;

const UNKNOWN_AGE_OFFSET = 0;

/** Starosna kategorija takmičenja = najstarija kategorija koja se na njemu takmiči. */
export function competitionAgeOffset(categories: Iterable<string>, fallbackAgeCategory: string) {
  const offsets = [...categories].map((c) => FOCUS_AGE_OFFSET[c]).filter((o): o is number => o != null);
  if (offsets.length) return Math.min(...offsets);
  return FOCUS_AGE_OFFSET[fallbackAgeCategory] ?? UNKNOWN_AGE_OFFSET;
}

export function is300mCompetition(name: string) {
  return /(^|[^\d])300\s?m\b/i.test(name);
}

function baseTier(level: string, eventType: string) {
  switch (level) {
    case "olympic": return 0;
    case "world": return eventType === "championship" ? 1 : 2;
    case "continental": return eventType === "championship" ? 3 : 5;
    case "international": return eventType === "champions_league" || eventType === "grand_prix" ? 6 : 7;
    case "national": return 8;
    case "regional": return 9;
    case "club": return 10;
    default: return 10;
  }
}

export type FocusPriorityInput = {
  name: string;
  level: string;
  eventType: string;
  ageCategory: string;
  focusPriority: number | null;
};

/** Podrazumevana vrednost (bez ručnog override-a). */
export function defaultFocusPriority(
  competition: Omit<FocusPriorityInput, "focusPriority">,
  categories: Iterable<string> = [],
) {
  const base = baseTier(competition.level, competition.eventType);
  // Olimpijske igre su uvek 0, bez pomaka.
  if (base === 0) return 0;
  const age = competitionAgeOffset(categories, competition.ageCategory);
  const distance = is300mCompetition(competition.name) ? FOCUS_300M_OFFSET : 0;
  return Math.min(FOCUS_PRIORITY_MAX, base + age + distance);
}

/** Ručni override ako postoji, inače podrazumevana vrednost. */
export function effectiveFocusPriority(competition: FocusPriorityInput, categories: Iterable<string> = []) {
  return competition.focusPriority ?? defaultFocusPriority(competition, categories);
}

/** Parsira unos iz admin forme: prazno → null (auto), inače ceo broj u opsegu. */
export function parseFocusPriorityInput(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value == null || value === "") return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < FOCUS_PRIORITY_MIN || n > FOCUS_PRIORITY_MAX) return { ok: false };
  return { ok: true, value: n };
}
