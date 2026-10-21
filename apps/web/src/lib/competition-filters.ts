import type { CompetitionEventType } from "@/lib/forma";
/**
 * Model filtera na /takmicenja: dve ose sa višestrukim izborom.
 *  - nivo       -> kolona competitions.level (grupisano za prikaz)
 *  - disciplina -> kolona competitions.discipline_groups ('air' | 'smallbore')
 * Izvor (SSS / ISSF / ESC) nije filter; to je kolona `organizer` i interna stvar.
 */

export const DISCIPLINE_GROUPS = ["air", "smallbore"] as const;
export type DisciplineGroup = (typeof DISCIPLINE_GROUPS)[number];

export const LEVEL_GROUPS = [
  { key: "world", levels: ["olympic", "world"] },
  { key: "continental", levels: ["continental"] },
  { key: "international", levels: ["international"] },
  { key: "national", levels: ["national"] },
  { key: "regional", levels: ["regional", "club"] },
] as const;
export type LevelGroupKey = (typeof LEVEL_GROUPS)[number]["key"];

/** ISSF opseg: svetski (uklj. olimpijski), kontinentalni i međunarodni nivo. */
export const ISSF_LEVEL_GROUP_KEYS: readonly LevelGroupKey[] = ["world", "continental", "international"];

const LEVEL_KEY_BY_LEVEL: Record<string, LevelGroupKey> = Object.fromEntries(
  LEVEL_GROUPS.flatMap((group) => group.levels.map((level) => [level, group.key])),
);

const DISCIPLINE_FROM_LEGACY_TAG: Record<string, DisciplineGroup> = {
  "10m": "air", MK: "smallbore", "50m": "smallbore", "25m": "smallbore", "50/25m": "smallbore",
};

function splitList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((part) => part.trim()).filter(Boolean);
}

/** `level=national,continental`; prihvata i stare pojedinačne nivoe (`world`, `club`...). */
export function parseLevelParam(value: string | undefined): LevelGroupKey[] {
  const keys = new Set<LevelGroupKey>();
  for (const part of splitList(value)) {
    const key = LEVEL_KEY_BY_LEVEL[part] ?? (LEVEL_GROUPS.some((g) => g.key === part) ? (part as LevelGroupKey) : null);
    if (key) keys.add(key);
  }
  return [...keys];
}

/** `disc=air,smallbore`; stari `tag=10m|MK|50m|25m` se mapiraju na grupe. */
export function parseDisciplineParam(disc: string | undefined, legacyTag?: string): DisciplineGroup[] {
  const groups = new Set<DisciplineGroup>();
  for (const part of splitList(disc)) {
    if ((DISCIPLINE_GROUPS as readonly string[]).includes(part)) groups.add(part as DisciplineGroup);
  }
  const legacy = legacyTag ? DISCIPLINE_FROM_LEGACY_TAG[legacyTag] : undefined;
  if (legacy) groups.add(legacy);
  return [...groups];
}

/** Konkretni nivoi (kolona `level`) za izabrane grupe. */
export function levelsForGroups(keys: readonly LevelGroupKey[]): string[] {
  return LEVEL_GROUPS.filter((group) => keys.includes(group.key)).flatMap((group) => [...group.levels]);
}

// ── Izvođenje grupa disciplina ──────────────────────────────────────────────

/** `disciplines.distance`: 10 -> vazdušno, 25 / 50 -> malokalibarsko. */
export function groupsFromDistances(distances: ReadonlyArray<number | null | undefined>): DisciplineGroup[] {
  const groups: DisciplineGroup[] = [];
  if (distances.some((d) => d === 10)) groups.push("air");
  if (distances.some((d) => d === 25 || d === 50)) groups.push("smallbore");
  return groups;
}

/**
 * Procena iz naziva takmičenja, za događaje bez rezultata. "10" mora imati "m",
 * da se "10. kolo" i "25. memorijal" ne računaju kao daljina.
 */
export function groupsFromName(name: string): DisciplineGroup[] {
  const groups: DisciplineGroup[] = [];
  if (/(\b10\s?m\b|vazdu[sš]n|air\s+(rifle|pistol))/i.test(name)) groups.push("air");
  if (/(\bMK\b|malokalibar|\b(25|50)\s?m\b|small.?bore|3\s?-?position|rapid.?fire|free\s+pistol|sport\s+pistol)/i.test(name)) groups.push("smallbore");
  return groups;
}

/**
 * Tip takmičenja iz naziva (prvo poklapanje pobeđuje). Ulazi u težinu forme
 * (level + event_type), pa novo takmičenje ne sme ostati "other" ako naziv kaže više.
 */
export function eventTypeFromName(name: string): CompetitionEventType {
  if (/champions\s+league/i.test(name)) return "champions_league";
  if (/\bleague\b|\bliga\b/i.test(name)) return "league_round";
  if (/grand\s+prix|\bGP\b/i.test(name)) return "grand_prix";
  if (/world\s+cup|svetski\s+kup/i.test(name)) return "world_cup";
  if (/championship|prvenstv|olympic\s+qualification/i.test(name)) return "championship";
  if (/\bcup\b|\bkup|trofej|\bopen\b/i.test(name)) return "cup";
  return "other";
}

export function mergeGroups(...lists: ReadonlyArray<readonly DisciplineGroup[]>): DisciplineGroup[] {
  const set = new Set(lists.flat());
  return DISCIPLINE_GROUPS.filter((group) => set.has(group));
}
