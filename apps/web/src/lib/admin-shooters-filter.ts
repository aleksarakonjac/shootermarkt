import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { shooters } from "@shootermarkt/db/schema";

/** Filter params shared by the admin shooters list and its bulk actions. */
export type ShooterFilterParams = Partial<Record<"q" | "nat" | "gender" | "apparatus" | "verified", string>>;

export function buildShootersWhere(sp: ShooterFilterParams) {
  const q = sp.q?.trim() ?? "";
  const nat = sp.nat?.trim() ?? "";
  const gender = sp.gender?.trim() ?? "";
  const apparatus = sp.apparatus?.trim() ?? "";
  return and(
    q
      ? and(...q.split(/\s+/).filter(Boolean).map((word) => or(ilike(shooters.firstName, `%${word}%`), ilike(shooters.lastName, `%${word}%`))))
      : undefined,
    nat ? eq(shooters.nationality, nat) : undefined,
    gender ? eq(shooters.gender, gender) : undefined,
    // "none" = strelci bez oružja (npr. novi iz live cron-a)
    apparatus === "none" ? isNull(shooters.apparatus) : apparatus ? eq(shooters.apparatus, apparatus) : undefined,
    sp.verified === "0" ? eq(shooters.verified, false) : undefined,
  );
}
