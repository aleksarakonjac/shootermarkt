export function deriveFinalRankProgression(
  cumulative: readonly number[] | undefined,
  peerCumulatives: readonly (readonly number[] | undefined)[],
): Array<number | null> | null {
  if (!cumulative?.length) return null;

  return cumulative.map((score, index) => {
    const scores = peerCumulatives.flatMap((values) => {
      const value = values?.[index];
      return value == null ? [] : [value];
    });

    return scores.length > 1 ? 1 + scores.filter((value) => value > score).length : null;
  });
}
