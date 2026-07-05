import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { competitions, results } from "@/lib/db/schema";
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

  const [comp, [{ resultCount }]] = await Promise.all([
    db.query.competitions.findFirst({ where: eq(competitions.id, compId) }),
    db.select({ resultCount: count() }).from(results).where(eq(results.competitionId, compId)),
  ]);

  if (!comp) notFound();

  return (
    <CompetitionEditClient
      competition={{
        id: comp.id,
        name: comp.name,
        date: comp.date,
        dateEnd: comp.dateEnd,
        location: comp.location,
        level: comp.level as CompetitionLevel,
        resultCount,
      }}
    />
  );
}
