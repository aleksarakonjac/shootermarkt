export const LEVEL_LABEL: Record<string, string> = {
  club:          "Klubsko",
  regional:      "Regionalno",
  national:      "Državno",
  international: "Međunarodno",
  continental:   "Kontinentalno",
  world:         "Svetsko",
  olympic:       "Olimpijsko",
};

// Inline CSS for server components (matches Tailwind pastel classes in sync client)
export const LEVEL_STYLE: Record<string, { background: string; color: string }> = {
  world:         { background: "#eff6ff", color: "#1d4ed8" },
  continental:   { background: "#faf5ff", color: "#7e22ce" },
  international: { background: "#f0f9ff", color: "#0369a1" },
  olympic:       { background: "#fefce8", color: "#a16207" },
  national:      { background: "#f0fdf4", color: "#15803d" },
  regional:      { background: "#fff7ed", color: "#c2410c" },
  club:          { background: "#f3f4f6", color: "#4b5563" },
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
