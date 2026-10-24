import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { ageCategoryEnum, competitionLevelEnum, competitions, eventTypeEnum, results } from "@shootermarkt/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { requireAdmin } from "@/lib/admin-auth";
import { parseFocusPriorityInput } from "@/lib/competition-priority";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

type Category = (typeof ageCategoryEnum.enumValues)[number];
type CompetitionSet = Partial<typeof competitions.$inferInsert>;

/** Svi rezultati meča (takmičenje × disciplina × zaseban meč × kategorija) prelaze u novu kategoriju. */
export type BulkMatchChange = { competitionId: number; disciplineId: number; eventId: number | null; from: Category; to: Category };

const isIn = <T extends string>(values: readonly T[], v: unknown): v is T => typeof v === "string" && values.includes(v as T);
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v.trim() || null : undefined);

// Polja koja ulaze u težinu forme (datum → time-decay, nivo/tip → težina nivoa)
const FORMA_FIELDS = ["date", "dateEnd", "level", "eventType"] as const;

/** Izmena jednog takmičenja iz admin liste → `set` za update, ili poruka greške. Samo poslata polja se menjaju. */
function parseCompetitionChange(c: Record<string, unknown>): { set: CompetitionSet } | { error: string } {
  const set: CompetitionSet = {};
  const has = (k: string) => c[k] !== undefined;

  if (has("name")) {
    const v = text(c.name, 300);
    if (!v) return { error: "originalni naziv je obavezan (do 300 znakova)" };
    set.name = v;
  }
  for (const [k, max] of [["nameSr", 300], ["nameEn", 300], ["location", 200], ["locationSr", 200], ["locationEn", 200], ["organizer", 50], ["issfId", 50], ["siusId", 50], ["sourcePdfUrl", 2000]] as const) {
    if (!has(k)) continue;
    if (c[k] !== null && text(c[k], max) === undefined) return { error: `${k}: najviše ${max} znakova` };
    set[k] = c[k] === null ? null : text(c[k], max);
  }
  if (has("date")) {
    if (!isDate(c.date)) return { error: "datum mora biti YYYY-MM-DD" };
    set.date = c.date;
  }
  if (has("dateEnd")) {
    if (c.dateEnd !== null && c.dateEnd !== "" && !isDate(c.dateEnd)) return { error: "datum do mora biti YYYY-MM-DD" };
    set.dateEnd = c.dateEnd || null;
  }
  if (has("countryId")) {
    if (c.countryId !== null && !isId(c.countryId)) return { error: "neispravna država" };
    set.countryId = c.countryId as number | null;
  }
  if (has("level")) {
    if (!isIn(competitionLevelEnum.enumValues, c.level)) return { error: "nepoznat nivo" };
    set.level = c.level;
  }
  if (has("eventType")) {
    if (!isIn(eventTypeEnum.enumValues, c.eventType)) return { error: "nepoznat tip" };
    set.eventType = c.eventType;
  }
  if (has("ageCategory")) {
    if (!isIn(ageCategoryEnum.enumValues, c.ageCategory)) return { error: "nepoznat uzrast" };
    set.ageCategory = c.ageCategory;
  }
  if (has("focusPriority")) {
    const parsed = parseFocusPriorityInput(c.focusPriority);
    if (!parsed.ok) return { error: "prioritet mora biti ceo broj 0–20 ili prazan" };
    set.focusPriority = parsed.value;
  }
  if (has("tags")) {
    if (!(Array.isArray(c.tags) && c.tags.every((t) => typeof t === "string" && t.trim() && t.length <= 20))) return { error: "tag mora imati 1–20 znakova" };
    set.tags = [...new Set(c.tags.map((t: string) => t.trim()))];
  }
  if (has("disciplineGroups")) {
    if (!(Array.isArray(c.disciplineGroups) && c.disciplineGroups.every((g) => g === "air" || g === "smallbore"))) return { error: "neispravna grupa disciplina" };
    set.disciplineGroups = c.disciplineGroups;
  }
  if (has("timezone")) {
    const v = text(c.timezone, 100);
    if (!v) return { error: "vremenska zona je obavezna" };
    set.timezone = v;
  }
  return { set };
}

function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const code = err.cause?.code ?? err.code;
  if (code !== "23505") return null;
  return err.cause?.constraint_name ?? err.constraint_name ?? "";
}

/**
 * Bulk izmena takmičenja iz admin kalendara: bilo koje polje takmičenja i kategorija po meču.
 * Sve u jednoj transakciji; posle upisa se preračunava forma strelaca čija takmičenja su
 * promenila datum, nivo, tip ili kategoriju meča.
 */
async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const comps: unknown[] = Array.isArray(body?.competitions) ? body.competitions : [];
  const matches: unknown[] = Array.isArray(body?.matches) ? body.matches : [];

  const compChanges: { id: number; set: CompetitionSet }[] = [];
  for (const raw of comps) {
    const c = raw as Record<string, unknown>;
    if (!isId(c.id)) return NextResponse.json({ error: "Neispravan id takmičenja" }, { status: 400 });
    const parsed = parseCompetitionChange(c);
    if ("error" in parsed) return NextResponse.json({ error: `#${c.id}: ${parsed.error}`, competitionId: c.id }, { status: 400 });
    if (Object.keys(parsed.set).length) compChanges.push({ id: c.id, set: parsed.set });
  }

  const matchChanges: BulkMatchChange[] = [];
  for (const raw of matches) {
    const m = raw as Record<string, unknown>;
    if (!isId(m.competitionId) || !isId(m.disciplineId) || !(m.eventId === null || isId(m.eventId)) || !isIn(ageCategoryEnum.enumValues, m.from) || !isIn(ageCategoryEnum.enumValues, m.to)) {
      return NextResponse.json({ error: "Neispravna izmena kategorije meča" }, { status: 400 });
    }
    if (m.from !== m.to) matchChanges.push({ competitionId: m.competitionId, disciplineId: m.disciplineId, eventId: m.eventId as number | null, from: m.from, to: m.to });
  }

  if (compChanges.length === 0 && matchChanges.length === 0) return NextResponse.json({ updated: 0 });

  // Koje takmičenje se upisuje u trenutku greške — da poruka kaže gde je problem
  let current = 0;
  try {
    await db.transaction(async (tx) => {
      for (const c of compChanges) {
        current = c.id;
        await tx.update(competitions).set(c.set).where(eq(competitions.id, c.id));
      }
      for (const m of matchChanges) {
        current = m.competitionId;
        await tx.update(results).set({ category: m.to }).where(and(
          eq(results.competitionId, m.competitionId),
          eq(results.disciplineId, m.disciplineId),
          m.eventId === null ? isNull(results.competitionEventId) : eq(results.competitionEventId, m.eventId),
          eq(results.category, m.from),
        ));
      }
    });
  } catch (e) {
    const constraint = uniqueViolation(e);
    if (constraint === null) throw e;
    const what = constraint.includes("issf") ? "ISSF id već koristi drugo takmičenje"
      : constraint.includes("scius") || constraint.includes("sius") ? "SIUS id već koristi drugo takmičenje"
      : "neki strelac već ima rezultat u ciljnoj kategoriji tog meča";
    return NextResponse.json({ error: `#${current}: ${what} — ništa nije sačuvano.`, competitionId: current }, { status: 409 });
  }

  const touched = [...new Set([
    ...compChanges.filter((c) => FORMA_FIELDS.some((k) => k in c.set)).map((c) => c.id),
    ...matchChanges.map((m) => m.competitionId),
  ])];
  if (touched.length) {
    const shooterRows = await db.selectDistinct({ shooterId: results.shooterId }).from(results).where(inArray(results.competitionId, touched));
    await recomputeFormaCache(shooterRows.map((r) => r.shooterId));
  }

  return NextResponse.json({ updated: compChanges.length + matchChanges.length });
}

export const POST = revalidatesPublicSite(handlePOST);
