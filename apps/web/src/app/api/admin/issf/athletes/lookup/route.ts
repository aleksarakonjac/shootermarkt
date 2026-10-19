import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { lookupIssfAthletes } from "@shootermarkt/adapters/issf/sync";

// GET ?first=&last=&noc= → rangirani ISSF kandidati za strelca koga nemamo
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const last = sp.get("last")?.trim() ?? "";
  if (last.length < 2) return NextResponse.json({ error: "Prezime je obavezno" }, { status: 400 });

  try {
    return NextResponse.json(await lookupIssfAthletes(sp.get("first")?.trim() ?? "", last, sp.get("noc")?.trim().toUpperCase()));
  } catch (e) {
    console.error("[issf/lookup] failed:", e);
    return NextResponse.json({ error: "ISSF pretraga nije uspela" }, { status: 502 });
  }
}
