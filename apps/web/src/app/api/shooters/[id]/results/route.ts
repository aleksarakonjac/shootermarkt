import { NextRequest, NextResponse } from "next/server";
import { getShooterResultsPage } from "@/lib/shooter-results";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shooterId = Number(id);
  if (!Number.isInteger(shooterId) || shooterId < 1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const date = request.nextUrl.searchParams.get("date");
  const cursorId = Number(request.nextUrl.searchParams.get("id"));
  const cursor = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(cursorId) && cursorId > 0
    ? { date, id: cursorId }
    : undefined;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const query = request.nextUrl.searchParams.get("q")?.trim();
  return NextResponse.json(await getShooterResultsPage(shooterId, cursor, {
    from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
    to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
    query: query || undefined,
  }), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
