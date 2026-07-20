import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importIssfNation } from "@/lib/issf/import-nation";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

function hasScriptSecret(req: NextRequest) {
  const secret = process.env.IMPORT_SECRET;
  return secret && req.headers.get("x-import-secret") === secret;
}

function cancelled() {
  return NextResponse.json({ cancelled: true }, { status: 499 });
}

export async function POST(req: NextRequest) {
  if (!hasScriptSecret(req)) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
