import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { clubs } from "@shootermarkt/db/schema";
import { asc, ilike } from "drizzle-orm";

const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([], { headers });

  const data = await db
    .select({ id: clubs.id, name: clubs.name, city: clubs.city })
    .from(clubs)
    .where(ilike(clubs.name, `%${q}%`))
    .orderBy(asc(clubs.name))
    .limit(20);

  return NextResponse.json(data, { headers });
}
