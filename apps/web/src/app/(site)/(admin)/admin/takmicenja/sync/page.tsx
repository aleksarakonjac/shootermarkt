import type { Metadata } from "next";
import { db } from "@shootermarkt/db";
import { countries } from "@shootermarkt/db/schema";
import { CompetitionsSyncClient } from "./competitions-sync-client";

export const metadata: Metadata = { title: "Admin · Sync takmičenja" };

export default async function TakmicenjaSyncPage() {
  const countryRows = await db
    .select({ id: countries.id, name: countries.name, code2: countries.code2 })
    .from(countries)
    .orderBy(countries.name);
  return <CompetitionsSyncClient countries={countryRows} />;
}
