import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { syncUpcomingSchedules } from "@/lib/schedule-sync";

export const maxDuration = 60;

// Manual run of the same sync the daily cron does.
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ results: await syncUpcomingSchedules() });
}
