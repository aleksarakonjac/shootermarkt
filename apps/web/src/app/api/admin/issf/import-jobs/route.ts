import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { queueIssfImportJob } from "@/lib/issf/jobs";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await queueIssfImportJob(), { status: 202 });
  } catch (e) {
    console.error("[issf/import-jobs] queueIssfImportJob failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Pokretanje ISSF importa nije uspelo: ${msg}` }, { status: 500 });
  }
}
