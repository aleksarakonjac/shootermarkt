import { CompetitionFormClient } from "./competition-form-client";
import { db } from "@shootermarkt/db";
import { countries } from "@shootermarkt/db/schema";

export const metadata = { title: "Admin · Novo takmičenje" };

export default async function NovoTakmicenjePage() {
  const countryRows = await db.select({ id: countries.id, name: countries.name, nameSr: countries.nameSr, nameEn: countries.nameEn, code2: countries.code2, code: countries.code, nocCode: countries.nocCode }).from(countries).orderBy(countries.name);
  return <CompetitionFormClient countries={countryRows} />;
}
