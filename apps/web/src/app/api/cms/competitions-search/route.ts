import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { ilike, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json([], { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  const data = await db
    .select({ id: competitions.id, name: competitions.name, date: competitions.date })
    .from(competitions)
    .where(q ? ilike(competitions.name, `%${q}%`) : undefined)
    .orderBy(desc(competitions.date))
    .limit(20);

  return NextResponse.json(data, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
