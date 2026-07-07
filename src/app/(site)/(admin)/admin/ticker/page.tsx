import { db } from "@/lib/db";
import {
  competitions, competitionSchedule, disciplines,
  tickerLiveOverrides, tickerCustomUpcoming, countries,
} from "@/lib/db/schema";
import { gte, lte, and, eq, asc } from "drizzle-orm";
import type { Metadata } from "next";
import { TickerAdminClient } from "./ticker-client";

export const metadata: Metadata = { title: "Admin · Ticker" };

export default async function AdminTickerPage() {
  const today = new Date().toISOString().split("T")[0];
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [upcomingComps, allSlots, allDisciplines, overrides, customUpcoming] = await Promise.all([
    // Competitions in next 30 days (+ already started today)
    db.select({
      id: competitions.id,
      name: competitions.name,
      date: competitions.date,
      dateEnd: competitions.dateEnd,
      location: competitions.location,
      level: competitions.level,
      countryCode2: countries.code2,
      nocCode: countries.nocCode,
    })
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .where(and(gte(competitions.date, today), lte(competitions.date, in30days)))
      .orderBy(asc(competitions.date)),

    // All schedule slots for those competitions
    db.select({
      id: competitionSchedule.id,
      competitionId: competitionSchedule.competitionId,
      disciplineId: competitionSchedule.disciplineId,
      disciplineCode: disciplines.code,
      disciplineName: disciplines.name,
      stage: competitionSchedule.stage,
      startTime: competitionSchedule.startTime,
      endTime: competitionSchedule.endTime,
    })
      .from(competitionSchedule)
      .innerJoin(disciplines, eq(competitionSchedule.disciplineId, disciplines.id))
      .innerJoin(competitions, eq(competitionSchedule.competitionId, competitions.id))
      .where(and(gte(competitions.date, today), lte(competitions.date, in30days)))
      .orderBy(asc(competitionSchedule.startTime)),

    // All disciplines (for add-slot form)
    db.select({ id: disciplines.id, code: disciplines.code, name: disciplines.name })
      .from(disciplines)
      .orderBy(disciplines.code),

    // Active overrides
    db.select({
      id: tickerLiveOverrides.id,
      competitionId: tickerLiveOverrides.competitionId,
      isActive: tickerLiveOverrides.isActive,
      customSlides: tickerLiveOverrides.customSlides,
      priority: tickerLiveOverrides.priority,
      label: tickerLiveOverrides.label,
      createdAt: tickerLiveOverrides.createdAt,
    })
      .from(tickerLiveOverrides)
      .orderBy(asc(tickerLiveOverrides.priority)),

    // Custom upcoming entries
    db.select()
      .from(tickerCustomUpcoming)
      .orderBy(asc(tickerCustomUpcoming.date)),
  ]);

  // Determine currently live slots (startTime <= now <= endTime or startTime <= now if no endTime)
  const now = new Date();
  const liveSlots = allSlots.filter(s =>
    s.startTime <= now && (s.endTime == null || s.endTime >= now)
  );

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Ticker</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Upravljanje live i najava tickerom</p>
        </div>
        {liveSlots.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--brand-primary)] text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" style={{ animation: "ticker-pulse 1.4s ease-in-out infinite" }} />
            {liveSlots.length} AKTIVAN
          </span>
        )}
      </div>

      <TickerAdminClient
        competitions={upcomingComps}
        slots={allSlots.map(s => ({
          ...s,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime?.toISOString() ?? null,
        }))}
        disciplines={allDisciplines}
        overrides={overrides.map(o => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        }))}
        customUpcoming={customUpcoming.map(c => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        }))}
        liveSlotIds={liveSlots.map(s => s.id)}
      />
    </div>
  );
}
