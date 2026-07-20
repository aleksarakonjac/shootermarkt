import { db } from "@/lib/db";
import { competitions, disciplines, countries } from "@/lib/db/schema";
import { gte, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ISSFScheduleImportClient } from "./schedule-client";

export const metadata: Metadata = { title: "Admin · ISSF Satnica" };

export default async function ISSFScheduleImportPage() {
  const today = new Date().toISOString().split("T")[0];

  const [comps, discs] = await Promise.all([
    db.select({
      id: competitions.id,
      name: competitions.name,
      date: competitions.date,
      dateEnd: competitions.dateEnd,
      nocCode: countries.nocCode,
    })
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .where(gte(competitions.date, today))
      .orderBy(asc(competitions.date)),

    db.select({ id: disciplines.id, code: disciplines.code, name: disciplines.name })
      .from(disciplines)
      .orderBy(disciplines.code),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">ISSF Satnica Import</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Preuzmi satnicu sa ISSF sajta i importuj u bazu radi popunjavanja tickera
        </p>
      </div>
      <ISSFScheduleImportClient competitions={comps} disciplines={discs} />
    </div>
  );
}
