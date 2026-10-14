import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { shooters } from "@shootermarkt/db/schema";
import { MVP_APPARATUS } from "@/lib/mvp-scope";

/** Filter params shared by the admin shooters list and its bulk actions. */
export type ShooterFilterParams = Partial<Record<"q" | "nat" | "gender" | "apparatus" | "verified" | "no_apparatus", string>>;

export function buildShootersWhere(sp: ShooterFilterParams) {
  const q = sp.q?.trim() ?? "";
  const nat = sp.nat?.trim() ?? "";
  const gender = sp.gender?.trim() ?? "";
  const apparatus = sp.apparatus?.trim() ?? "";
  return and(
    sp.no_apparatus === "1" ? undefined : inArray(shooters.apparatus, [...MVP_APPARATUS]),
    q
      ? and(...q.split(/\s+/).filter(Boolean).map((word) => or(ilike(shooters.firstName, `%${word}%`), ilike(shooters.lastName, `%${word}%`))))
      : undefined,
    nat ? eq(shooters.nationality, nat) : undefined,
    gender ? eq(shooters.gender, gender) : undefined,
    apparatus ? eq(shooters.apparatus, apparatus) : undefined,
    sp.verified === "0" ? eq(shooters.verified, false) : undefined,
  );
}
