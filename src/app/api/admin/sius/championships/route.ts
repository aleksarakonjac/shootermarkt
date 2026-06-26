import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchChampionships } from "@/lib/sius/adapter";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const championships = await fetchChampionships();
    return NextResponse.json(championships);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
