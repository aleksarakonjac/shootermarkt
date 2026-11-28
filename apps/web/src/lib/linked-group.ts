/**
 * Grupa rezultata na koju link `?disc=` pokazuje. Tačan ključ ("ARM", "ARM@12") ima prednost; goli kod bez
 * takve grupe (In focus ne zna za zasebne mečeve) vodi na najnoviji meč te discipline.
 */
export function findLinkedGroup<T extends { key: string; code: string; date: string | null }>(groups: T[], disc: string, has: (group: T) => boolean): T | undefined {
  const matching = groups.filter(has);
  return matching.find((group) => group.key === disc)
    ?? matching.filter((group) => group.code === disc).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
}
