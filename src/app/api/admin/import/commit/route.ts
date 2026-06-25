import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { shooters, clubs, competitions, results, disciplines } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { CommitPayload } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined): boolean {
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

  if (!comp.name || !comp.date || !comp.level) {
    return NextResponse.json({ error: "Competition fields required" }, { status: 400 });
  }

  // 1. Upsert competition
  let competitionId: number;
  const existing = await db.query.competitions.findFirst({
    where: and(eq(competitions.name, comp.name), eq(competitions.date, comp.date)),
  });

  if (existing) {
    competitionId = existing.id;
  } else {
    const [inserted] = await db
      .insert(competitions)
      .values({
        name: comp.name,
        date: comp.date,
        location: comp.location,
        level: comp.level,
      })
      .returning({ id: competitions.id });
    competitionId = inserted.id;
  }

  // 2. Load disciplines map
  const disciplineRows = await db.select().from(disciplines);
  const disciplineMap = Object.fromEntries(disciplineRows.map((d) => [d.code, d.id]));

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.skip) { skipped++; continue; }

    try {
      // 3. Upsert club if clubNoc given but no clubId
      let clubId = row.clubId;
      if (!clubId && row.clubNoc) {
        const existingClub = await db.query.clubs.findFirst({
          where: eq(clubs.nocCode, row.clubNoc),
        });
        if (existingClub) {
          clubId = existingClub.id;
        } else {
          const [newClub] = await db
            .insert(clubs)
            .values({ name: row.clubNoc, nocCode: row.clubNoc })
            .returning({ id: clubs.id });
          clubId = newClub.id;
        }
      }

      // 4. Upsert shooter
      let shooterId = row.shooterId;
      if (!shooterId) {
        const existingShooter = await db.query.shooters.findFirst({
          where: and(
            eq(shooters.firstName, row.firstName),
            eq(shooters.lastName, row.lastName)
          ),
        });
        if (existingShooter) {
          shooterId = existingShooter.id;
        } else {
          const [newShooter] = await db
            .insert(shooters)
            .values({
              firstName: row.firstName,
              lastName: row.lastName,
              clubId: clubId ?? null,
              createdBySelf: false,
              verified: false,
            })
            .returning({ id: shooters.id });
          shooterId = newShooter.id;
        }
      }

      const disciplineId = disciplineMap[row.disciplineCode];
      if (!disciplineId) {
        errors.push(`Unknown discipline: ${row.disciplineCode}`);
        continue;
      }

      // 5. Insert result (ignore conflict — same shooter/comp/discipline)
      await db
        .insert(results)
        .values({
          shooterId,
          competitionId,
          disciplineId,
          qualTotal: row.qualTotal.toString(),
          qualInners: row.qualInners ?? null,
          qualRank: row.qualRank ?? null,
          qualSeries: row.qualSeries ?? null,
          qualified: row.qualified ?? null,
          finalTotal: row.finalTotal?.toString() ?? null,
          finalRank: row.finalRank ?? null,
          source: "pdf_import",
        })
        .onConflictDoNothing();

      inserted++;
    } catch (err) {
      errors.push(`${row.lastName} ${row.firstName}: ${String(err)}`);
    }
  }

  return NextResponse.json({ inserted, skipped, errors, competitionId });
}
