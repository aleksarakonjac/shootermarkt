import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncUpcomingSchedules } from "@/lib/schedule-sync";
import { autoLinkSius } from "@/lib/sius-autolink";

export const maxDuration = 60;

// Every 6 h (cron-job.org): pulls ISSF schedules for competitions starting within 14 days or in progress,
// and links SIUS UUIDs for competitions starting today or tomorrow.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const secret = req.headers.get("x-cron-secret");
  // Header only (a secret in the URL ends up in logs); constant-time compare.
  if (!expected || !secret || secret.length !== expected.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Pre satnice, da neuspeh ili timeout satnice ne preskoči povezivanje
  const siusLinked = await autoLinkSius().then((links) => Object.fromEntries(links), (error) => {
    console.warn("[schedule-sync] SIUS auto-link failed:", error);
    return null;
  });
  const results = await syncUpcomingSchedules();
  console.log("[schedule-sync]", JSON.stringify(results));
  return NextResponse.json({ ok: true, results, siusLinked });
}
