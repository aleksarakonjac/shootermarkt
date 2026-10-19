import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { tickerLiveOverrides } from "@shootermarkt/db/schema";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { competitionId, type, label, customSlides, priority, href } = body;

  const [override] = await db.insert(tickerLiveOverrides).values({
    type:          type ?? "live",
    competitionId: competitionId ?? null,
    isActive:      true,
    label:         label ?? null,
    customSlides:  customSlides ?? null,
    priority:      priority ?? 0,
    href:          href ?? null,
  }).returning();

  revalidatePath("/", "layout");
  return NextResponse.json(override, { status: 201 });
}
