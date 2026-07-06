export const LEVEL_LABEL: Record<string, string> = {
  club:          "Klubsko",
  regional:      "Regionalno",
  national:      "Državno",
  international: "Međunarodno",
  continental:   "Kontinentalno",
  world:         "Svetsko",
  olympic:       "Olimpijsko",
};

export const LEVEL_LABEL_EN: Record<string, string> = {
  club:          "Club",
  regional:      "Regional",
  national:      "National",
  international: "International",
  continental:   "Continental",
  world:         "World",
  olympic:       "Olympic",
};

export function getLevelLabel(level: string, locale: string): string {
  const map = locale === "en" ? LEVEL_LABEL_EN : LEVEL_LABEL;
  return map[level] ?? level;
}

/**
 * Resolve the best competition name for the given locale.
 * Falls back to canonical `name` when translation is absent.
 */
export function getCompetitionName(
  comp: { name: string; nameSr?: string | null; nameEn?: string | null },
  locale: string
): string {
  if (locale === "en") return comp.nameEn ?? comp.name;
  if (locale === "sr") return comp.nameSr ?? comp.name;
  return comp.name;
}

export const LEVEL_STYLE: Record<string, { background: string; color: string }> = {
  world:         { background: "var(--level-world-bg)",         color: "var(--level-world-fg)" },
  continental:   { background: "var(--level-continental-bg)",   color: "var(--level-continental-fg)" },
  international: { background: "var(--level-international-bg)", color: "var(--level-international-fg)" },
  olympic:       { background: "var(--level-olympic-bg)",       color: "var(--level-olympic-fg)" },
  national:      { background: "var(--level-national-bg)",      color: "var(--level-national-fg)" },
  regional:      { background: "var(--level-regional-bg)",      color: "var(--level-regional-fg)" },
  club:          { background: "var(--level-club-bg)",          color: "var(--level-club-fg)" },
};

// For color dots in filter dropdowns (text color = saturated hue)
export const LEVEL_DOT_COLOR: Record<string, string> = {
  world:         "#1d4ed8",
  continental:   "#7e22ce",
  international: "#0369a1",
  olympic:       "#a16207",
  national:      "#15803d",
  regional:      "#c2410c",
  club:          "#4b5563",
};
