import { CompetitionFormClient } from "./competition-form-client";
import { db } from "@/lib/db";
import { countries } from "@/lib/db/schema";

export const metadata = { title: "Admin · Novo takmičenje" };

export default async function NovoTakmicenjePage() {
  const countryRows = await db.select({ id: countries.id, name: countries.name, code2: countries.code2 }).from(countries).orderBy(countries.name);
  return <CompetitionFormClient countries={countryRows} />;
}
