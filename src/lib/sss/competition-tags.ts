export type SssCompetitionTag = "10m" | "MK" | "50m" | "25m" | "50/25m";

export const SSS_TAG_STYLE: Record<SssCompetitionTag, { background: string; color: string }> = {
  "10m": { background: "#dbeafe", color: "#1d4ed8" },
  "MK": { background: "#fef3c7", color: "#a16207" },
  "50m": { background: "#dcfce7", color: "#15803d" },
  "25m": { background: "#dcfce7", color: "#15803d" },
  "50/25m": { background: "#fef3c7", color: "#a16207" },
};

/** Derives distance tags from the competition name used by SSS. */
export function getSssCompetitionTags(name: string): SssCompetitionTag[] {
  const normalized = name.toUpperCase();
  const hasMk = /\bMK\b|MALOKALIBAR/.test(normalized);
  const has10m = /\b10\s*M?\b/.test(normalized);
  const has50m = /\b50\s*M?\b/.test(normalized);
  const has25m = /\b25\s*M?\b/.test(normalized);
  const tags: SssCompetitionTag[] = [];

  if (has10m) tags.push("10m");
  if (hasMk) tags.push("MK");
  if (has50m && has25m) tags.push("50/25m");
  else if (has50m) tags.push("50m");
  else if (has25m) tags.push("25m");

  return tags;
}
