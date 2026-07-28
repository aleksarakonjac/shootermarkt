import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";

// ISSF competitionType.id → our CompetitionLevel
// null = exclude (non-competition event like a course/seminar)
const TYPE_MAP: Record<number, CompetitionLevel> = {
  1:  "world",        // ISSF World Cup
  2:  "world",        // ISSF World Cup Final
  3:  "world",        // ISSF World Championships
  4:  "olympic",      // Olympic Games
  5:  "continental",  // European Championships
  6:  "continental",  // African Championships
  7:  "continental",  // (reserved, likely continental)
  8:  "continental",  // Asian Championships
  9:  "continental",  // Asian Games
  10: "continental",  // Continental American Championships
  11: "continental",  // Pan American Games
  12: "continental",  // Oceania Championships
  13: "continental",  // African Games (seen in older data)
  20: "continental",  // European Games
  24: "world",        // ISSF Junior World Cup
  25: "world",        // ISSF Grand Prix
  26: "world",        // Olympic Qualification Championship
  28: "world",        // ISSF Junior World Championships
};

export function detectCompetitionLevel(typeId: number | undefined): CompetitionLevel | null {
  if (!typeId) return null;
  return TYPE_MAP[typeId] ?? null;
}

export function isRiflePistolCompetition(
  disciplines: Array<{ id: number; name: string }> | undefined,
  name: string,
): boolean {
  if (disciplines?.length) {
    return disciplines.some(
      (d) => d.name === "Rifle" || d.name === "Pistol"
    );
  }
  // Fallback to name match if disciplines not present
  const n = name.toLowerCase();
  return n.includes("rifle") || n.includes("pistol") || n.includes("10m");
}
