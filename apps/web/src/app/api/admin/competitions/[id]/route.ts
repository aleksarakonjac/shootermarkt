import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions, results } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";
import { parseFocusPriorityInput } from "@/lib/competition-priority";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const compId = parseInt(id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { name, nameSr, nameEn, date, dateEnd, location, locationSr, locationEn, countryId, level, tags, disciplineGroups, issfId, siusId, focusPriority } = body;

  if (!name?.trim() || !date || !level) {
    return NextResponse.json({ error: "Naziv, datum i nivo su obavezni" }, { status: 400 });
  }
  const parsedCountryId = countryId == null || countryId === "" ? null : Number(countryId);
  if (parsedCountryId !== null && !Number.isInteger(parsedCountryId)) {
    return NextResponse.json({ error: "Neispravna država" }, { status: 400 });
  }

  const parsedPriority = parseFocusPriorityInput(focusPriority);
  if (!parsedPriority.ok) {
    return NextResponse.json({ error: "Prioritet mora biti ceo broj od 0 do 20 ili prazno (auto)" }, { status: 400 });
  }

  const [updated] = await db
    .update(competitions)
    .set({
      name: name.trim(),
      nameSr: nameSr?.trim() || null,
      nameEn: nameEn?.trim() || null,
      date,
      dateEnd: dateEnd?.trim() && dateEnd.trim() !== date ? dateEnd.trim() : null,
      location: location?.trim() || null,
      locationSr: locationSr?.trim() || null,
      locationEn: locationEn?.trim() || null,
      countryId: parsedCountryId,
      level: level as CompetitionLevel,
      issfId: issfId?.trim() || null,
      siusId: siusId?.trim() || null,
      focusPriority: parsedPriority.value,
      ...(Array.isArray(tags) ? { tags: tags.map(String) } : {}),
      ...(Array.isArray(disciplineGroups) ? { disciplineGroups: disciplineGroups.filter((g: unknown): g is string => g === "air" || g === "smallbore") } : {}),
    })
    .where(eq(competitions.id, compId))
    .returning({ id: competitions.id });

  if (!updated) return NextResponse.json({ error: "Nije pronađeno" }, { status: 404 });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const compId = parseInt(id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const affectedShooterIds = await db
    .select({ shooterId: results.shooterId })
    .from(results)
    .where(eq(results.competitionId, compId));

  // Delete results first (no CASCADE in schema)
  await db.delete(results).where(eq(results.competitionId, compId));
  await db.delete(competitions).where(eq(competitions.id, compId));
  await recomputeFormaCache(affectedShooterIds.map((row) => row.shooterId));

  return NextResponse.json({ ok: true });
}
