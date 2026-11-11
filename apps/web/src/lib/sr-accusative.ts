// Nazivi država koji se ne menjaju u akuzativu: množina srednjeg roda na -a ("Kukova Ostrva") i nepromenljivo "Samoa".
const UNCHANGED = /(^|\s)(Ostrva|Samoa)(\s|$)/;

/**
 * Akuzativ naziva države za "kvota za ...": ženski rod jednine na -a prelazi u -u
 * (Srbija → Srbiju, Slovačka → Slovačku, Bosna i Hercegovina → Bosnu i Hercegovinu); muški rod, srednji rod
 * i množina ostaju isti (Egipat, Ujedinjeno Kraljevstvo, Sjedinjene Države). Zagrada u nazivu se odseca.
 */
export function serbianAccusative(name: string): string {
  const clean = name.replace(/\s*\(.*\)\s*$/, "").trim();
  if (UNCHANGED.test(clean)) return clean;
  return clean.split(" ").map((word) => (word.length > 2 && word.endsWith("a") ? `${word.slice(0, -1)}u` : word)).join(" ");
}
