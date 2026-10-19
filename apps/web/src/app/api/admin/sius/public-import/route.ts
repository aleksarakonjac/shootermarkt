import { NextRequest, NextResponse } from "next/server";
import { buildSiusImport, SiusImportError } from "@/lib/sius-import";
import { requireAdmin } from "@/lib/admin-auth";

export type { SiusFinalEntry } from "@/lib/sius-import";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

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
