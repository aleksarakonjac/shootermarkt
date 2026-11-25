import { NextRequest, NextResponse } from "next/server";
import { buildSiusImport, mergeSiusFinals, SiusImportError } from "@/lib/sius-import";
import { diffSiusImport } from "@/lib/sius-bulk";
import { requireAdmin } from "@/lib/admin-auth";

export type { SiusFinalEntry } from "@/lib/sius-import";

/** Read-only: fetches SIUS results for review and compares them with what the competition already has. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { siusId, disciplineCodes, competitionId } = (await req.json()) as { siusId: string; disciplineCodes?: string[]; competitionId: number };
  if (!siusId?.trim() || !Number.isInteger(competitionId)) {
    return NextResponse.json({ error: "siusId and competitionId required" }, { status: 400 });
  }

  try {
    const data = await buildSiusImport(siusId, disciplineCodes, competitionId);
    const diff = await diffSiusImport(competitionId, mergeSiusFinals(data.rows, data.finalEntries), data.teamEntries);
    return NextResponse.json({ ...data, diff });
  } catch (e) {
    if (e instanceof SiusImportError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
