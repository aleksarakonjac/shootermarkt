import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { shooters, clubs, competitions, results, disciplines } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DISCIPLINE_META, type CommitPayload } from "@/lib/pdf-import/types";
import { matchShooter } from "@/lib/name-match";
import { recomputeFormaCache } from "@/lib/forma-cache";

const DISCIPLINE_DISTANCE_TAGS: Record<string, string[]> = {
  ARM: ["10m"], ARW: ["10m"], APM: ["10m"], APW: ["10m"],
  R3PM: ["25m", "50m"], R3PW: ["25m", "50m"], R3JM: ["25m", "50m"], R3JW: ["25m", "50m"],
  SPW: ["25m"], RFPM: ["25m"],
  FPM: ["50m"],
};

function distanceTagsFromCodes(codes: string[]): string[] {
  const tags = new Set<string>();
  for (const code of codes) {
    for (const t of DISCIPLINE_DISTANCE_TAGS[code] ?? []) tags.add(t);
  }
  return [...tags];
}

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as CommitPayload;
  const { competition: comp, rows } = payload;
  const competitionTags = payload.tags ?? comp?.tags ?? [];

  // 1. Resolve competition
  let competitionId: number;
  if (payload.competitionId) {
    competitionId = payload.competitionId;
    if (competitionTags.length) {
      await db.update(competitions).set({
        tags: sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, ${competitionTags}::varchar[])))`,
      }).where(eq(competitions.id, competitionId));
    }
  } else {
    if (!comp || !comp.name || !comp.date || !comp.level) {
      return NextResponse.json({ error: "Izaberi takmičenje ili popuni podatke" }, { status: 400 });
    }
    const existingComp = await db.query.competitions.findFirst({
      where: and(eq(competitions.name, comp.name), eq(competitions.date, comp.date)),
    });
    if (existingComp) {
      competitionId = existingComp.id;
      if (competitionTags.length) {
        await db.update(competitions).set({
          tags: sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, ${competitionTags}::varchar[])))`,
        }).where(eq(competitions.id, competitionId));
      }
    } else {
      const [ins] = await db
        .insert(competitions)
        .values({
          name: comp.name,
          date: comp.date,
          dateEnd: comp.dateEnd ?? null,
          location: comp.location,
          level: comp.level,
          eventType: comp.eventType ?? "other",
          organizer: comp.organizer ?? null,
          tags: competitionTags,
        })
        .returning({ id: competitions.id });
      competitionId = ins.id;
    }
  }

  // 2. Disciplines map
  const disciplineRows = await db.select().from(disciplines);
  const disciplineMap = Object.fromEntries(disciplineRows.map((d) => [d.code, d.id]));

  // Preload strelci za fold-matching (đ/dj/d + akcenti) u fallback-u
  const allShooters = await db
    .select({
      id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName,
      nationality: shooters.nationality, clubId: shooters.clubId,
      birthYear: shooters.birthYear, apparatus: shooters.apparatus,
    })
    .from(shooters);

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const affectedShooterIds = new Set<number>();

  for (const row of rows) {
    if (row.skip) { skipped++; continue; }

    try {
      // 3. Upsert club
      let clubId = row.clubId;
      if (!clubId && row.clubAbbr) {
        // Try to find by name or noc_code
        const existingClub = await db.query.clubs.findFirst({
          where: eq(clubs.nocCode, row.clubAbbr),
        });
        if (existingClub) {
          clubId = existingClub.id;
        } else {
          // Create provisional club — admin can enrich later
          const [newClub] = await db
            .insert(clubs)
            .values({
              name: row.clubAbbr,
              nocCode: row.clubAbbr,
              countryCode: row.teamNoc,
            })
            .returning({ id: clubs.id });
          clubId = newClub.id;
        }
      }

      // 4. Upsert shooter — fold-matching (rešava đ/dj/d) u fallback-u
      let shooterId = row.shooterId;
      if (!shooterId) {
        const m = matchShooter(row.firstName, row.lastName, row.teamNoc || null, allShooters);
        const existing = m.kind === "exact" ? allShooters.find((s) => s.id === m.id) : undefined;
        if (existing) {
          shooterId = existing.id;
          // Backfill: klub, godište, apparatus ako fale a bilten ih ima
          const patch: Partial<typeof shooters.$inferInsert> = {};
          if (!existing.clubId && clubId) patch.clubId = clubId;
          if (!existing.birthYear && row.birthYear) patch.birthYear = row.birthYear;
          if (!existing.apparatus && (row.apparatus ?? DISCIPLINE_META[row.disciplineCode]?.apparatus)) {
            patch.apparatus = row.apparatus ?? DISCIPLINE_META[row.disciplineCode].apparatus;
          }
          if (Object.keys(patch).length > 0) {
            await db.update(shooters).set(patch).where(eq(shooters.id, existing.id));
          }
        } else {
          // Novi strelac iz biltena — apparatus/gender iz discipline (bez apparatus
          // strelac bi bio nevidljiv u /strelci zbog MVP filtera), godište iz biltena.
          const meta = DISCIPLINE_META[row.disciplineCode];
          const [newShooter] = await db
            .insert(shooters)
            .values({
              firstName: row.firstName,
              lastName: row.lastName,
              nationality: row.teamNoc || null,
              birthYear: row.birthYear ?? null,
              gender: row.gender ?? meta?.gender ?? null,
              apparatus: row.apparatus ?? meta?.apparatus ?? null,
              clubId: clubId ?? null,
              createdBySelf: false,
              verified: false,
            })
            .returning({ id: shooters.id });
          shooterId = newShooter.id;
          // Dodaj u fold-index da drugi red istog strelca (druga disciplina) ne pravi duplikat
          allShooters.push({
            id: newShooter.id, firstName: row.firstName, lastName: row.lastName,
            nationality: row.teamNoc || null, clubId: clubId ?? null,
            birthYear: row.birthYear ?? null,
            apparatus: row.apparatus ?? meta?.apparatus ?? null,
          });
        }
      }

      if (shooterId) affectedShooterIds.add(shooterId);

      const disciplineId = disciplineMap[row.disciplineCode];
      if (!disciplineId) {
        errors.push(`Unknown discipline: ${row.disciplineCode}`);
        continue;
      }

      // 5. Insert result
      await db
        .insert(results)
        .values({
          shooterId,
          competitionId,
          disciplineId,
          category: (row.category ?? "senior") as typeof results.$inferInsert.category,
          clubId: clubId ?? null,
          qualTotal: row.qualTotal.toString(),
          qualInners: row.qualInners ?? null,
          qualRank: row.qualRank ?? null,
          qualDetail: row.qualPositions
            ? { kneeling: row.qualPositions.kneeling, prone: row.qualPositions.prone, standing: row.qualPositions.standing }
            : row.qualSeries ? { series: row.qualSeries }
            : null,
          qualified: row.qualified ?? null,
          elimRound: row.elimRound ?? null,
          elimTotal: row.elimTotal ?? null,
          elimRank: row.elimRank ?? null,
          finalTotal: row.finalTotal?.toString() ?? null,
          finalRank: row.finalRank ?? null,
          finalDetail: row.finalSeries || row.finalShots || row.finalCumulative || row.finalShotsByStage
            ? {
                format: "bulletin",
                scoring: row.finalScoring ?? "decimal",
                ...(row.finalSeries ? { series: row.finalSeries } : {}),
                ...(row.finalSeriesLabels ? { seriesLabels: row.finalSeriesLabels } : {}),
                ...(row.finalShots ? { shots: row.finalShots } : {}),
                ...(row.finalShotsByStage ? { shotsByStage: row.finalShotsByStage } : {}),
                ...(row.finalCumulative ? { cumulative: row.finalCumulative } : {}),
                ...(row.finalRanks ? { ranks: row.finalRanks } : {}),
                ...(row.finalShootOff ? { shootOff: true } : {}),
              }
            : null,
          remark: row.remark ?? null,
          source: payload.source ?? "pdf_import",
        })
        .onConflictDoNothing();

      inserted++;
    } catch (err) {
      errors.push(`${row.lastName} ${row.firstName} (${row.teamNoc}): ${String(err)}`);
    }
  }

  // Auto-tag competition with distance tags derived from committed disciplines
  const distanceTags = distanceTagsFromCodes(
    rows.filter((r) => !r.skip).map((r) => r.disciplineCode)
  );
  if (distanceTags.length > 0) {
    const arrLiteral = `{${distanceTags.map((t) => `"${t}"`).join(",")}}`;
    await db.update(competitions)
      .set({ tags: sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, ${sql.raw(`'${arrLiteral}'`)}::varchar[])))` })
      .where(eq(competitions.id, competitionId));
  }

  // Recompute forma cache for all affected shooters
  const affectedIds = [...affectedShooterIds];
  if (affectedIds.length > 0) {
    try {
      await recomputeFormaCache(affectedIds);
    } catch (e) {
      // Non-fatal — cache miss is fine, pages fall back to on-the-fly computation
      errors.push(`[forma-cache] ${String(e)}`);
    }
  }

  return NextResponse.json({ inserted, skipped, errors, competitionId });
}
