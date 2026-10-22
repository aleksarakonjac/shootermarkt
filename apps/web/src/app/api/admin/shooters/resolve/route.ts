import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { applyIssfProfile, IssfConflictError } from "@shootermarkt/adapters/issf/sync";
import { requireAdmin } from "@/lib/admin-auth";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { mergeShooters, MergeError } from "@/lib/merge-shooters";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

export type ResolveAction =
  | { shooterId: number; kind: "link"; issfId: string }
  | { shooterId: number; kind: "merge"; keepId: number }
  | { shooterId: number; kind: "dismiss" };

export type ResolveResult = { shooterId: number; ok: boolean; message: string };

const MAX_ACTIONS = 50;
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function parse(raw: unknown): ResolveAction | null {
  const a = raw as Record<string, unknown> | null;
  if (!a || !isId(a.shooterId)) return null;
  if (a.kind === "link" && typeof a.issfId === "string" && /^[A-Za-z0-9]{6,30}$/.test(a.issfId.trim())) return { shooterId: a.shooterId, kind: "link", issfId: a.issfId.trim() };
  if (a.kind === "merge" && isId(a.keepId) && a.keepId !== a.shooterId) return { shooterId: a.shooterId, kind: "merge", keepId: a.keepId };
  if (a.kind === "dismiss") return { shooterId: a.shooterId, kind: "dismiss" };
  return null;
}

/**
 * Bulk rešavanje nepovezanih strelaca. Svaka akcija je nezavisna — greška jedne
 * ne zaustavlja ostale. link: upiše issfId i dopuni prazna polja; merge: spoji u
 * postojećeg strelca (staro prezime → alias); dismiss: označi kao pregledanog.
 */
async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.actions) ? body.actions : [];
  if (raw.length === 0 || raw.length > MAX_ACTIONS) return NextResponse.json({ error: `Šalji 1–${MAX_ACTIONS} akcija` }, { status: 400 });
  const actions = raw.map(parse);
  if (actions.some((a) => !a)) return NextResponse.json({ error: "Neispravna akcija" }, { status: 400 });

  const out: ResolveResult[] = [];
  const mergedInto = new Set<number>();
  for (const a of actions as ResolveAction[]) {
    try {
      if (a.kind === "link") {
        const filled = await applyIssfProfile(a.shooterId, a.issfId);
        await db.update(shooters).set({ issfReviewedAt: new Date() }).where(eq(shooters.id, a.shooterId));
        out.push({ shooterId: a.shooterId, ok: true, message: filled.length ? `Povezan (dopunjeno: ${filled.join(", ")})` : "Povezan" });
      } else if (a.kind === "merge") {
        const plan = await mergeShooters(a.keepId, a.shooterId);
        mergedInto.add(a.keepId);
        out.push({ shooterId: a.shooterId, ok: true, message: `Spojen u #${a.keepId} (${plan.dropResults} rez.)` });
      } else {
        await db.update(shooters).set({ issfReviewedAt: new Date() }).where(eq(shooters.id, a.shooterId));
        out.push({ shooterId: a.shooterId, ok: true, message: "Označen kao pregledan" });
      }
    } catch (e) {
      const message = e instanceof IssfConflictError
        ? `ISSF ID već ima strelac #${e.shooterId} — spoji ga umesto povezivanja`
        : e instanceof MergeError || e instanceof Error ? e.message : "Greška";
      out.push({ shooterId: a.shooterId, ok: false, message });
    }
  }

  if (mergedInto.size) await recomputeFormaCache([...mergedInto]);
  return NextResponse.json({ results: out });
}

export const POST = revalidatesPublicSite(handlePOST);
