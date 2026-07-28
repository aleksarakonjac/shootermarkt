import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSiusEvents, fetchSiusSubEventsAll } from "@shootermarkt/adapters/sius/public-adapter";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
