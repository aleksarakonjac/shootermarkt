import { DISCIPLINE_META, type DisciplineCode } from "./pdf-import-types";

/** Nazivi iz docs/discipline-catalog.md ("Nazivi u aplikaciji"). Bez pola — profil je jedne osobe. */
const NAMES: Record<string, { sr: string; en: string }> = {
  ARM: { sr: "10m vazdušna puška", en: "10m Air Rifle" },
  ARW: { sr: "10m vazdušna puška", en: "10m Air Rifle" },
  APM: { sr: "10m vazdušni pištolj", en: "10m Air Pistol" },
  APW: { sr: "10m vazdušni pištolj", en: "10m Air Pistol" },
  ARMT: { sr: "10m vazdušna puška miks", en: "10m Air Rifle Mixed Team" },
  APMT: { sr: "10m vazdušni pištolj miks", en: "10m Air Pistol Mixed Team" },
  RPRM: { sr: "50m puška ležeći", en: "50m Rifle Prone" },
  RPRW: { sr: "50m puška ležeći", en: "50m Rifle Prone" },
  SPW: { sr: "25m pištolj", en: "25m Pistol" },
  SPM: { sr: "25m pištolj", en: "25m Pistol" },
  RFPM: { sr: "25m Rapid Fire pištolj", en: "25m Rapid Fire Pistol" },
  FPM: { sr: "50m pištolj", en: "50m Pistol" },
  STPM: { sr: "25m standard pištolj", en: "25m Standard Pistol" },
  STPW: { sr: "25m standard pištolj", en: "25m Standard Pistol" },
  R3P300M: { sr: "300m puška 3x20", en: "300m Rifle 3x20" },
  R3P300W: { sr: "300m puška 3x20", en: "300m Rifle 3x20" },
  RPR300M: { sr: "300m puška ležeći", en: "300m Rifle Prone" },
  RPR300W: { sr: "300m puška ležeći", en: "300m Rifle Prone" },
  STR300: { sr: "300m standard puška", en: "300m Standard Rifle" },
  SOLOARM: { sr: "10m vazdušna puška ESC Solo", en: "10m Air Rifle ESC Solo" },
  SOLOARW: { sr: "10m vazdušna puška ESC Solo", en: "10m Air Rifle ESC Solo" },
  SOLOAPM: { sr: "10m vazdušni pištolj ESC Solo", en: "10m Air Pistol ESC Solo" },
  SOLOAPW: { sr: "10m vazdušni pištolj ESC Solo", en: "10m Air Pistol ESC Solo" },
};

/** Redosled disciplina u programu takmičenja i u istoriji nastupa. */
export const DISCIPLINE_DISPLAY_ORDER = [
  "ARM", "ARW", "ARMT", "R3PM", "R3PW", "R3JM", "R3JW", "RPRM", "RPRW",
  "APM", "APW", "APMT", "SPW", "SPM", "STPW", "STPM", "RFPM", "FPM",
  "R3P300M", "R3P300W", "RPR300M", "RPR300W", "STR300",
  "SOLOARM", "SOLOARW", "SOLOAPM", "SOLOAPW",
];

export function disciplineName(
  code: string,
  locale: string,
  opts: { gender?: boolean; variant?: "3x20" | "3x40" } = {},
): string {
  const en = locale === "en";
  let base: string;
  if (code === "R3PM" || code === "R3PW" || code === "R3JM" || code === "R3JW") {
    const variant = code.startsWith("R3J") ? "3x20" : opts.variant ?? "3x40";
    base = en ? `50m Rifle ${variant}` : `50m puška ${variant}`;
  } else {
    const names = NAMES[code];
    if (!names) return code;
    base = en ? names.en : names.sr;
  }
  if (!opts.gender) return base;
  const gender = DISCIPLINE_META[code as DisciplineCode]?.gender ?? (code === "R3JM" ? "M" : code === "R3JW" ? "F" : null);
  if (!gender) return base;
  if (en) return `${base} ${gender === "M" ? "Men" : "Women"}`;
  return `${base} – ${gender === "M" ? "seniori" : "seniorke"}`;
}
