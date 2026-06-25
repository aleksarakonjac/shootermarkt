export interface FormaInput {
  qualTotal: number;
  date: string; // YYYY-MM-DD — used to sort (newest first expected)
}

export interface FormaResult {
  score: number;
  peak: number;
  trend: "up" | "down" | "stable";
  consistency: number; // 0–1, higher = more consistent
  resultsUsed: number;
}

/**
 * Weighted average of last N results.
 * Buckets: last 3 → 50%, 4–6 → 30%, 7–10 → 20%
 * + consistency bonus (std dev based) + trend coefficient
 */
export function computeFormaScore(
  results: FormaInput[],
  maxScore: number
): FormaResult | null {
  if (results.length === 0) return null;

  // Sort newest → oldest
  const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date));
  const scores = sorted.map((r) => r.qualTotal);
  const used = scores.slice(0, 10);

  const peak = Math.max(...scores);

  if (used.length === 0) return null;

  // Bucket weights
  const b1 = used.slice(0, 3);  // 50%
  const b2 = used.slice(3, 6);  // 30%
  const b3 = used.slice(6, 10); // 20%

  function wavg(bucket: number[], weight: number): { sum: number; w: number } {
    if (bucket.length === 0) return { sum: 0, w: 0 };
    const avg = bucket.reduce((a, b) => a + b, 0) / bucket.length;
    return { sum: avg * weight, w: weight };
  }

  const parts = [wavg(b1, 0.5), wavg(b2, 0.3), wavg(b3, 0.2)];
  const totalWeight = parts.reduce((a, p) => a + p.w, 0);
  const baseScore = parts.reduce((a, p) => a + p.sum, 0) / totalWeight;

  // Consistency: std dev of last 10 results, normalize by range
  const mean = used.reduce((a, b) => a + b, 0) / used.length;
  const variance =
    used.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / used.length;
  const stdDev = Math.sqrt(variance);
  // maxExpectedStdDev for shooting: ~5 points covers 99% of real distributions
  const maxExpectedStdDev = 5;
  const consistency = Math.max(0, 1 - stdDev / maxExpectedStdDev);

  // Consistency bonus: up to +0.5% of max score for perfect consistency
  const consistencyBonus = consistency * maxScore * 0.005;

  const score = Math.min(baseScore + consistencyBonus, maxScore);

  // Trend: compare average of last 3 vs previous 3
  const recentAvg =
    b1.length > 0 ? b1.reduce((a, b) => a + b, 0) / b1.length : null;
  const prevAvg =
    b2.length > 0 ? b2.reduce((a, b) => a + b, 0) / b2.length : null;

  let trend: "up" | "down" | "stable" = "stable";
  if (recentAvg !== null && prevAvg !== null) {
    const delta = recentAvg - prevAvg;
    const threshold = maxScore * 0.003; // ~1.8 points for ARM, ~1.8 for APM
    if (delta > threshold) trend = "up";
    else if (delta < -threshold) trend = "down";
  }

  return {
    score: Math.round(score * 10) / 10,
    peak,
    trend,
    consistency: Math.round(consistency * 100) / 100,
    resultsUsed: used.length,
  };
}

export function trendLabel(trend: "up" | "down" | "stable"): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

export function trendColor(trend: "up" | "down" | "stable"): string {
  if (trend === "up") return "var(--success)";
  if (trend === "down") return "var(--brand-primary)";
  return "var(--muted)";
}
