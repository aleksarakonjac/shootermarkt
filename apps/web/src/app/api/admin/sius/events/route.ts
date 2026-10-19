import { NextRequest, NextResponse } from "next/server";
import { fetchSiusEvents, fetchSiusSubEventsAll } from "@shootermarkt/adapters/sius/public-adapter";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const siusId = req.nextUrl.searchParams.get("siusId")?.trim();
  if (!siusId) return NextResponse.json({ error: "siusId required" }, { status: 400 });

  try {
    const events = await fetchSiusEvents(siusId);
    const withSubs = await Promise.all(
      events.map(async (e) => {
        try {
          const subEvents = await fetchSiusSubEventsAll(siusId, e.runningId);
          return { ...e, subEvents };
        } catch {
          return { ...e, subEvents: [] };
        }
      })
    );
    return NextResponse.json({ events: withSubs });
  } catch (e) {
    return NextResponse.json({ error: `SIUS fetch failed: ${e}` }, { status: 502 });
  }
}
