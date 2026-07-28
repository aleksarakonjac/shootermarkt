import { ShooterFormClient } from "./shooter-form-client";
import { db } from "@shootermarkt/db";
import { clubs } from "@shootermarkt/db/schema";
import { asc } from "drizzle-orm";

export const metadata = { title: "Admin · Novi strelac" };

export default async function NoviStrelacPage() {
  const allClubs = await db.select({ id: clubs.id, name: clubs.name, countryCode: clubs.countryCode }).from(clubs).orderBy(asc(clubs.name));
  return <ShooterFormClient clubs={allClubs} />;
}
