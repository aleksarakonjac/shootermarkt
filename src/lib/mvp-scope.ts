/**
 * Apparatus values included in MVP scope.
 * Shotgun (trap/skeet) and MK disciplines are out of scope for now.
 * Used to filter shooter queries across public and admin views.
 */
export const MVP_APPARATUS = ["air_rifle", "air_pistol", "rifle", "pistol"] as const;
