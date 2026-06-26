import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCalendarSync } from "@/lib/calendar/sync";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCalendarSync();
  return NextResponse.json(result);
}
