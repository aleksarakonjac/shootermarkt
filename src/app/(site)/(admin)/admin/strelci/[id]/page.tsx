import { db } from "@/lib/db";
import { shooters, clubs, results, competitions, disciplines, countries } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShooterAdminClient } from "./shooter-admin-client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await db.query.shooters.findFirst({ where: eq(shooters.id, parseInt(id)) });
  if (!s) return { title: "Strelac nije pronađen" };
  return { title: `Admin · ${s.lastName} ${s.firstName}` };
}

export default async function AdminShooterPage({ params }: Props) {
  const { id } = await params;
  const shooterId = parseInt(id);
  if (isNaN(shooterId)) notFound();

  const [shooter, allClubs, shooterResults] = await Promise.all([
    db
      .select({
        id: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        nationality: shooters.nationality,
        countryName: countries.name,
        gender: shooters.gender,
        birthYear: shooters.birthYear,
        birthDate: shooters.birthDate,
        clubId: shooters.clubId,
        issfId: shooters.issfId,
        avatarUrl: shooters.avatarUrl,
        apparatus: shooters.apparatus,
        verified: shooters.verified,
        createdBySelf: shooters.createdBySelf,
        clubName: clubs.name,
      })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .leftJoin(countries, eq(shooters.nationality, countries.code))
      .where(eq(shooters.id, shooterId))
      .limit(1)
      .then((r) => r[0]),
    db.select({ id: clubs.id, name: clubs.name }).from(clubs).orderBy(clubs.name),
    db
      .select({
        id: results.id,
        category: results.category,
        qualTotal: results.qualTotal,
        qualRank: results.qualRank,
        finalRank: results.finalRank,
        competitionName: competitions.name,
        competitionDate: competitions.date,
        disciplineCode: disciplines.code,
      })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(eq(results.shooterId, shooterId))
      .orderBy(asc(competitions.date)),
  ]);

  if (!shooter) notFound();

  return (
    <ShooterAdminClient
      shooter={{
        id: shooter.id,
        firstName: shooter.firstName,
        lastName: shooter.lastName,
        nationality: shooter.nationality ?? "",
        gender: shooter.gender ?? "",
        birthYear: shooter.birthYear ?? null,
        birthDate: shooter.birthDate ?? null,
        clubId: shooter.clubId ?? null,
        clubName: shooter.clubName ?? null,
        countryName: shooter.countryName ?? null,
        issfId: shooter.issfId ?? null,
        avatarUrl: shooter.avatarUrl ?? null,
        apparatus: shooter.apparatus ?? null,
        verified: shooter.verified,
        createdBySelf: shooter.createdBySelf,
      }}
      clubs={allClubs}
      results={shooterResults.map((r) => ({
        id: r.id,
        competitionName: r.competitionName,
        competitionDate: r.competitionDate,
        disciplineCode: r.disciplineCode,
        category: r.category,
        qualTotal: r.qualTotal ? parseFloat(r.qualTotal) : null,
        qualRank: r.qualRank,
        finalRank: r.finalRank,
      }))}
    />
  );
}
