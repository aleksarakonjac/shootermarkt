import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSiusEvents } from "@/lib/sius/public-adapter";

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
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: `SIUS fetch failed: ${e}` }, { status: 502 });
  }
}
