import { db } from "@shootermarkt/db";
import { competitions, disciplines, countries } from "@shootermarkt/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { ISSFScheduleImportClient } from "./schedule-client";

export const metadata: Metadata = { title: "Admin · ISSF Satnica" };

const ISSF_LEVELS = ["world", "olympic", "continental"] as const;

export default async function ISSFScheduleImportPage() {
  const today = new Date().toISOString().split("T")[0];

  const [comps, discs] = await Promise.all([
    db.select({
      id: competitions.id,
      name: competitions.name,
      date: competitions.date,
      dateEnd: competitions.dateEnd,
      location: competitions.location,
      nocCode: countries.nocCode,
    })
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .where(inArray(competitions.level, ISSF_LEVELS))
      .orderBy(desc(competitions.date)),

    db.select({ id: disciplines.id, code: disciplines.code, name: disciplines.name })
      .from(disciplines)
      .orderBy(disciplines.code),
  ]);

  // Featured = current (spans today) + next 3 upcoming + last 3 finished, closest first.
  const current = comps.filter((c) => c.date <= today && (c.dateEnd ?? c.date) >= today);
  const upcoming = comps.filter((c) => c.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const past = comps.filter((c) => (c.dateEnd ?? c.date) < today).slice(0, 3); // already date-desc from query
  const featured = [
    ...current.map((c) => ({ ...c, status: "current" as const })),
    ...upcoming.map((c) => ({ ...c, status: "upcoming" as const })),
    ...past.map((c) => ({ ...c, status: "past" as const })),
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">ISSF Satnica Import</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Preuzmi satnicu sa ISSF sajta i importuj u bazu radi popunjavanja tickera
        </p>
      </div>
      <ISSFScheduleImportClient competitions={comps} featured={featured} disciplines={discs} />
    </div>
  );
}
