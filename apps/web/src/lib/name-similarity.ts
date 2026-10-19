const tokens = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));

/** Jaccard overlap of competition-name words longer than 2 chars (0–1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  const inter = [...ta].filter((w) => tb.has(w)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}
