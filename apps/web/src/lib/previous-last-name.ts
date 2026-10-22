import { or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { shooters } from "@shootermarkt/db/schema";
import { foldName, foldNameSql } from "@shootermarkt/db/name-match";

/**
 * SQL uslov: neko od ranijih prezimena odgovara ILIKE obrascu.
 * `is not null` omogućava planeru da koristi parcijalni indeks (shooters_previous_last_names_idx),
 * pa OR sa ime/prezime trigram indeksima ide kroz BitmapOr umesto seq scan-a.
 */
export function previousLastNameLike(column: AnyColumn, pattern: string): SQL {
  return sql`(${column} is not null and exists (select 1 from unnest(${column}) as p where p ilike ${pattern}))`;
}

/**
 * SQL uslov za pretragu strelca po jednoj reči, bez obzira na dijakritike:
 * "djokovic", "đoković" i "Dokovic" se svi svode na isti foldName ključ.
 * Ide kroz trigram indekse nad foldNameSql(first_name/last_name) (migracija 0039).
 */
export function shooterNameLike(word: string, mode: "prefix" | "contains"): SQL | undefined {
  const key = foldName(word);
  if (!key) return undefined;
  // Ključ sadrži samo a-z, pa nema LIKE džokera za escape.
  const pattern = mode === "prefix" ? `${key}%` : `%${key}%`;
  return or(
    sql`${foldNameSql(shooters.firstName)} like ${pattern}`,
    sql`${foldNameSql(shooters.lastName)} like ${pattern}`,
    sql`(${shooters.previousLastNames} is not null and exists (select 1 from unnest(${shooters.previousLastNames}) as p where ${foldNameSql(sql`p`)} like ${pattern}))`,
  );
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
