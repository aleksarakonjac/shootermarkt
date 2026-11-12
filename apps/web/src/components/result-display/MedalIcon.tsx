"use client";

import { useLocale } from "next-intl";

/** Boje zlatne, srebrne i bronzane medalje za prva tri mesta. */
export const MEDAL_COLOR: Record<number, string> = {
  1: "oklch(0.75 0.14 85)",
  2: "oklch(0.75 0.01 85)",
  3: "oklch(0.60 0.10 55)",
};

/** Krug sa brojem mesta u boji medalje (zlato, srebro, bronza). */
export function MedalIcon({ rank }: { rank: number }) {
  const en = useLocale() === "en";
  const color = MEDAL_COLOR[rank];
  if (!color) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.65rem] font-bold text-white shrink-0"
      style={{ background: color }}
      aria-label={`${en ? "Place" : "Mesto"} ${rank}`}
    >
      {rank}
    </span>
  );
}
