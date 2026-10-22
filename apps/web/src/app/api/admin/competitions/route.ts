import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { desc } from "drizzle-orm";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";
import { parseFocusPriorityInput } from "@/lib/competition-priority";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

export async function GET(_req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const data = await db
    .select()
    .from(competitions)
    .orderBy(desc(competitions.date));

  return NextResponse.json(data);
}

async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { name, nameSr, nameEn, date, dateEnd, location, locationSr, locationEn, countryId, level, issfId, focusPriority } = body;

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

  const [comp] = await db
    .insert(competitions)
    .values({
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
      issfId: issfId ? String(issfId) : null,
      focusPriority: parsedPriority.value,
    })
    .onConflictDoNothing()
    .returning({ id: competitions.id, name: competitions.name });

  if (!comp) {
    return NextResponse.json({ error: "Takmičenje već postoji" }, { status: 409 });
  }

  return NextResponse.json({ id: comp.id, name: comp.name });
}

export const POST = revalidatesPublicSite(handlePOST);
