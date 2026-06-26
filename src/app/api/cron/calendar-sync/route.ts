import { NextRequest, NextResponse } from "next/server";
import { runCalendarSync } from "@/lib/calendar/sync";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCalendarSync();
  return NextResponse.json(result);
}
