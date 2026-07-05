import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const data = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      clubName: clubs.name,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(
      q ? or(ilike(shooters.lastName, `%${q}%`), ilike(shooters.firstName, `%${q}%`)) : undefined
    )
    .orderBy(shooters.lastName)
    .limit(20);

  return NextResponse.json(data);
}
