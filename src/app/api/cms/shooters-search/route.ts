import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq, ilike, or, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json([], { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  const data = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      nationality: shooters.nationality,
      clubName: clubs.name,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(
      q
        ? and(
            ...q
              .split(/\s+/)
              .filter(Boolean)
              .map((word) =>
                or(ilike(shooters.firstName, `%${word}%`), ilike(shooters.lastName, `%${word}%`))
              )
          )
        : undefined
    )
    .orderBy(shooters.lastName)
    .limit(20);

  return NextResponse.json(data, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
