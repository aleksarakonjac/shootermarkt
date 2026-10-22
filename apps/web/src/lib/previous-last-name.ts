import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import { foldName } from "@shootermarkt/db/name-match";

/** SQL uslov: neko od ranijih prezimena odgovara ILIKE obrascu. */
export function previousLastNameLike(column: AnyColumn, pattern: string): SQL {
  return sql`exists (select 1 from unnest(${column}) as p where p ilike ${pattern})`;
}

/**
 * Ako je upit pogodio samo ranije prezime (ne trenutno prezime ni ime), vrati to
 * prezime za prikaz u zagradi pored trenutnog.
 */
export function matchedPreviousLastName(
  query: string,
  firstName: string,
  lastName: string,
  previousLastNames: string[] | null | undefined,
): string | null {
  if (!previousLastNames?.length) return null;
  const terms = query.split(/\s+/).map(foldName).filter(Boolean);
  const current = [foldName(firstName), foldName(lastName)];
  return (
    previousLastNames.find((prev) =>
      terms.some((t) => foldName(prev).includes(t) && !current.some((c) => c.includes(t)))
    ) ?? null
  );
}
