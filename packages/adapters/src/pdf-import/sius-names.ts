import { foldName } from "@shootermarkt/db/name-match";
import type { ParsedBilten, ParsedFinalResult, ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";

type Person = { firstName: string; lastName: string };

/** "JOVANOVIC Stevan" → prezime su vodeće reči velikim slovima. */
export function splitName(full: string): Person & { fullName?: string } {
  const words = full.split(/\s+/);
  const firstLower = words.findIndex((w) => w !== w.toUpperCase());
  // "Prezime Ime" (međunarodni bez velikih slova): prva reč je prezime; sa tri i više reči to je samo
  // pretpostavka, pa se čuva i ceo zapis (vidi resolveGuessedNames)
  const cut = firstLower === -1 ? words.length - 1 : Math.max(firstLower, 1);
  const title = (w: string) => w.toLowerCase().replace(/(^|[-' ])\p{L}/gu, (c) => c.toUpperCase());
  return {
    lastName: title(words.slice(0, cut).join(" ")),
    firstName: words.slice(cut).join(" "),
    ...(firstLower === 0 && words.length > 2 ? { fullName: full } : {}),
  };
}

/** "Prezime Ime" od tri i više reči: ime počinje prvom rečju koja je poznato ime, inače je ime samo poslednja reč. */
export function splitGuessedName(full: string, isFirstName: (word: string) => boolean): Person {
  const words = full.split(/\s+/);
  const known = words.findIndex((w, i) => i > 0 && isFirstName(w));
  const cut = known === -1 ? words.length - 1 : known;
  return { lastName: words.slice(0, cut).join(" "), firstName: words.slice(cut).join(" ") };
}

/** Reč je ime ako se među poznatim ljudima češće javlja kao ime nego kao prezime. */
export function firstNameChecker(people: Person[]): (word: string) => boolean {
  const balance = new Map<string, number>();
  const count = (names: string, step: number) => {
    for (const word of names.split(/\s+/)) balance.set(foldName(word), (balance.get(foldName(word)) ?? 0) + step);
  };
  for (const p of people) { count(p.firstName, 1); count(p.lastName, -1); }
  return (word) => (balance.get(foldName(word)) ?? 0) > 0;
}

/** Ispravlja pretpostavljene podele imena u listama i mešovitim timovima; `known` su strelci iz baze. */
export function resolveGuessedNames(bilten: ParsedBilten, known: Person[]) {
  const people = bilten.events.flatMap((e) => e.results as (ParsedShooterResult | ParsedFinalResult)[]);
  // nedvosmislena imena iz samog biltena dopunjuju bazu
  const isFirstName = firstNameChecker([...known, ...people.filter((p) => !p.fullName)]);
  for (const p of people) if (p.fullName) Object.assign(p, splitGuessedName(p.fullName, isFirstName));
  for (const t of bilten.mixedTeams ?? []) {
    if (t.mFullName) ({ lastName: t.mLastName, firstName: t.mFirstName } = splitGuessedName(t.mFullName, isFirstName));
    if (t.fFullName) ({ lastName: t.fLastName, firstName: t.fFirstName } = splitGuessedName(t.fFullName, isFirstName));
  }
}
