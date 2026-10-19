import { NextRequest, NextResponse } from "next/server";
import { importIssfNation } from "@shootermarkt/adapters/issf/import-nation";
import { requireAdmin } from "@/lib/admin-auth";

function hasScriptSecret(req: NextRequest) {
  const secret = process.env.IMPORT_SECRET;
  return secret && req.headers.get("x-import-secret") === secret;
}

function cancelled() {
  return NextResponse.json({ cancelled: true }, { status: 499 });
}

export async function POST(req: NextRequest) {
  if (!hasScriptSecret(req)) {
    const denied = await requireAdmin();
    if (denied) return denied;
  }

  const { noc } = await req.json();
  if (!noc?.trim()) return NextResponse.json({ error: "NOC kod je obavezan" }, { status: 400 });

  try {
    return NextResponse.json(await importIssfNation(noc.trim(), req.signal));
  } catch (error) {
    if (req.signal.aborted) return cancelled();
    console.error(`[bulk-nation] import failed for ${noc}:`, error);
    return NextResponse.json({ error: "Uvoz nacije nije uspeo" }, { status: 500 });
  }
}
