import { NextRequest, NextResponse } from "next/server";
import { syncUpcomingSchedules } from "@/lib/schedule-sync";

export const maxDuration = 60;

// Daily (cron-job.org): pulls ISSF schedules for competitions starting within 14 days or in progress.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await syncUpcomingSchedules();
  console.log("[schedule-sync]", JSON.stringify(results));
  return NextResponse.json({ ok: true, results });
}
