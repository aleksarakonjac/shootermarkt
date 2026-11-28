/** Zajedničko za SIUS strane: stavke teksta sa koordinatama, rezultati i nacija iz kolone kluba. */
import { NOC_LIST } from "@shootermarkt/db/noc-list";

export type Item = { x: number; y: number; str: string };

export const SCORE = /^(\d+(?:\.\d)?)(?:-\s*(\d+)x)?$/;
export const NOCS = new Set<string>(NOC_LIST.map((c) => c.noc));

/** Zaglavlje je najviše na strani; legenda u podnožju ponavlja iste reči. */
export const topmost = (items: Item[]) => (label: string) => items.filter((it) => it.str === label).sort((a, b) => b.y - a.y)[0];

/** Nacija iz kolone kluba: međunarodni "CRO-DALMACIJA", domaći gost "SVETKAVITSA - BUL", inače domaći klub. */
export function clubNation(club: string) {
  // "BiH-…" se piše i malim slovom; prefiks mora biti stvarna oznaka države da domaći klub ne postane strani
  const foreign = /^([A-Za-z]{3})\s*-/.exec(club)?.[1].toUpperCase();
  // međunarodna oznaka nosi (skraćen) naziv kluba ili reprezentacije — od nje se ne pravi klub u bazi
  if (foreign && NOCS.has(foreign)) return { teamNoc: foreign, clubName: undefined };
  const guest = /^(.*?)\s*-\s*([A-Z]{3})$/.exec(club);
  if (guest) return { teamNoc: guest[2], clubName: guest[1] || undefined };
  // država nije navedena: SRB važi za domaći bilten, strani ispravlja resolveNations
  return { teamNoc: "SRB", clubName: club || undefined, nationUnstated: true };
}

/** Uz zbir u istoj stavci umeju da stoje oznake i godište: "630.2 J", "553.5 DNF J", "558- 6x 2012", "566-16x 20". */
export const scoreText = (str: string) => str.replace(/(\s+([A-Z]+|(19|20)(\d\d)?))+$/, "");

const english = new Intl.DisplayNames(["en"], { type: "region" });
const byName = new Map(NOC_LIST.filter((c) => /^[A-Z]{2}$/.test(c.alpha2)).map((c) => [english.of(c.alpha2)!.toLowerCase(), c.noc]));

/** Tim nazvan po državi ("Bulgaria 2", "AIN 1", "SRB") → njen NOC; naziv kluba → undefined. */
export function countryNoc(label: string): string | undefined {
  const stem = label.replace(/\s*\d+$/, "").trim();
  return NOCS.has(stem) ? stem : byName.get(stem.toLowerCase());
}
