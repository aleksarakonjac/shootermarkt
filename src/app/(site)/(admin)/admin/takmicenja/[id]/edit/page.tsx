import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { competitions, countries, results } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { CompetitionEditClient } from "./competition-edit-client";
import type { Metadata } from "next";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

export const metadata: Metadata = { title: "Admin · Uredi takmičenje" };

export default async function CompetitionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const compId = parseInt(id);
  if (isNaN(compId)) notFound();

  const [comp, [{ resultCount }], countryRows] = await Promise.all([
    db.query.competitions.findFirst({ where: eq(competitions.id, compId) }),
    db.select({ resultCount: count() }).from(results).where(eq(results.competitionId, compId)),
    db.select({ id: countries.id, name: countries.name, code2: countries.code2 }).from(countries).orderBy(countries.name),
  ]);

  if (!comp) notFound();

  return (
    <CompetitionEditClient
      competition={{
        id: comp.id,
        name: comp.name,
        nameSr: comp.nameSr,
        nameEn: comp.nameEn,
        date: comp.date,
        dateEnd: comp.dateEnd,
        location: comp.location,
        locationSr: comp.locationSr,
        locationEn: comp.locationEn,
        countryId: comp.countryId,
        level: comp.level as CompetitionLevel,
        issfId: comp.issfId,
        siusId: comp.siusId,
        tags: comp.tags ?? [],
        resultCount,
      }}
      countries={countryRows}
    />
  );
}
