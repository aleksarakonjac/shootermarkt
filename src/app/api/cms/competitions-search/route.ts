import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { ilike, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const data = await db
    .select({ id: competitions.id, name: competitions.name, date: competitions.date })
    .from(competitions)
    .where(q ? ilike(competitions.name, `%${q}%`) : undefined)
    .orderBy(desc(competitions.date))
    .limit(20);

  return NextResponse.json(data);
}
