import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { MERGE_FIELDS, MergeError, mergePreview, mergeShooters, type MergeOptions } from "@/lib/merge-shooters";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

type Ctx = { params: Promise<{ id: string }> };

// GET ?other=<id> → oba strelca + svi rezultati (označeni isti mečevi). Ovaj strelac (id) ostaje, other se briše.
export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const keepId = Number((await params).id);
  const dropId = Number(req.nextUrl.searchParams.get("other"));
  if (!Number.isInteger(keepId) || !Number.isInteger(dropId)) return NextResponse.json({ error: "Neispravan strelac" }, { status: 400 });
  try {
    return NextResponse.json(await mergePreview(keepId, dropId));
  } catch (e) {
    if (e instanceof MergeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

// POST { otherId, fields?, resultIds? } → spoji other u ovog strelca (MergeOptions u lib/merge-shooters.ts).
async function handlePOST(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const keepId = Number((await params).id);
  const body = (await req.json().catch(() => ({}))) as { otherId?: number; fields?: Record<string, string>; resultIds?: number[] };
  const dropId = Number(body.otherId);
  if (!Number.isInteger(keepId) || !Number.isInteger(dropId)) return NextResponse.json({ error: "Neispravan strelac" }, { status: 400 });

  const opts: MergeOptions = {};
  if (body.fields) {
    opts.fields = {};
    for (const f of MERGE_FIELDS) if (body.fields[f] === "keep" || body.fields[f] === "drop") opts.fields[f] = body.fields[f] as "keep" | "drop";
  }
  if (Array.isArray(body.resultIds)) opts.resultIds = body.resultIds.map(Number).filter(Number.isInteger);

  try {
    await mergeShooters(keepId, dropId, opts);
  } catch (e) {
    if (e instanceof MergeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  await recomputeFormaCache([keepId]);
  return NextResponse.json({ ok: true });
}
export const POST = revalidatesPublicSite(handlePOST);
