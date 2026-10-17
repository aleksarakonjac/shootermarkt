import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSiusImport, SiusImportError } from "@/lib/sius-import";

export type { SiusFinalEntry } from "@/lib/sius-import";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siusId, disciplineCodes } = (await req.json()) as { siusId: string; disciplineCodes?: string[] };
  if (!siusId?.trim()) {
    return NextResponse.json({ error: "siusId required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await buildSiusImport(siusId, disciplineCodes));
  } catch (e) {
    if (e instanceof SiusImportError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
