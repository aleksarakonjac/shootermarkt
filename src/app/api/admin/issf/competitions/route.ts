import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCompetitions } from "@/lib/issf/adapter";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year =
    parseInt(req.nextUrl.searchParams.get("year") ?? "") ||
    new Date().getFullYear();

  const competitions = await fetchCompetitions(year);

  const relevant = competitions.filter(
    (c) =>
      c.name.toLowerCase().includes("rifle") ||
      c.name.toLowerCase().includes("pistol") ||
      c.name.toLowerCase().includes("10m")
  );

  return NextResponse.json(relevant);
}
