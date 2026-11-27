/** Zajedničko za SIUS strane: stavke teksta sa koordinatama, rezultati i nacija iz kolone kluba. */
import { NOC_LIST } from "@shootermarkt/db/noc-list";

export type Item = { x: number; y: number; str: string };

export const SCORE = /^(\d+(?:\.\d)?)(?:-\s*(\d+)x)?$/;
const NOCS = new Set<string>(NOC_LIST.map((c) => c.noc));

/** Zaglavlje je najviše na strani; legenda u podnožju ponavlja iste reči. */
export const topmost = (items: Item[]) => (label: string) => items.filter((it) => it.str === label).sort((a, b) => b.y - a.y)[0];

/** Nacija iz kolone kluba: međunarodni "CRO-DALMACIJA", domaći gost "SVETKAVITSA - BUL", inače domaći klub. */
export function clubNation(club: string) {
  // "BiH-…" se piše i malim slovom; prefiks mora biti stvarna oznaka države da domaći klub ne postane strani
  const foreign = /^([A-Za-z]{3})\s*-/.exec(club)?.[1].toUpperCase();
  // međunarodna oznaka nosi (skraćen) naziv kluba ili reprezentacije — od nje se ne pravi klub u bazi
  if (foreign && NOCS.has(foreign)) return { teamNoc: foreign, clubName: undefined };
  const guest = /^(.*?)\s*-\s*([A-Z]{3})$/.exec(club);
  return { teamNoc: guest ? guest[2] : "SRB", clubName: (guest ? guest[1] : club) || undefined };
}
