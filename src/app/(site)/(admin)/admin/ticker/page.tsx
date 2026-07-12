import { db } from "@/lib/db";
import {
  competitions, competitionSchedule, disciplines,
  tickerLiveOverrides, tickerCustomUpcoming, countries,
} from "@/lib/db/schema";
import { gte, lte, and, eq, asc, or } from "drizzle-orm";
import type { Metadata } from "next";
import { TickerAdminClient } from "./ticker-client";
import { USKORO_LEAD_DAYS } from "@/app/(site)/[locale]/(public)/ticker";
import { getPublishedArticles } from "@/lib/cms/get-articles";

export const metadata: Metadata = { title: "Admin · Ticker" };

export default async function AdminTickerPage() {
  const today    = new Date().toISOString().split("T")[0];
  // eslint-disable-next-line react-hooks/purity
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  // Max lead days = 5 (olympic), fetch everything up to 5 days ahead for USKORO detection
  // eslint-disable-next-line react-hooks/purity
  const in5days  = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [upcomingComps, allSlots, allDisciplines, overrides, customUpcoming, uskoro5days, recentArticles] = await Promise.all([
    // Competitions in next 30 days
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
      category: competitionSchedule.category,
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

    // All overrides (live, uskoro, article, custom)
    db.select({
      id: tickerLiveOverrides.id,
      type: tickerLiveOverrides.type,
      competitionId: tickerLiveOverrides.competitionId,
      isActive: tickerLiveOverrides.isActive,
      customSlides: tickerLiveOverrides.customSlides,
      priority: tickerLiveOverrides.priority,
      label: tickerLiveOverrides.label,
      href: tickerLiveOverrides.href,
      createdAt: tickerLiveOverrides.createdAt,
    })
      .from(tickerLiveOverrides)
      .orderBy(asc(tickerLiveOverrides.priority)),

    // Custom upcoming (bottom bar)
    db.select()
      .from(tickerCustomUpcoming)
      .orderBy(asc(tickerCustomUpcoming.date)),

    // Comps in next 5 days (for USKORO auto-detection preview)

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
      .where(and(gte(competitions.date, today), lte(competitions.date, in5days)))
      .orderBy(asc(competitions.date)),

    // 10 most recent articles from Payload CMS (for article ticker picker)
    getPublishedArticles({ limit: 10 }).catch(() => []),
  ]);

  const now = new Date();

  // Auto-detect live slots
  const liveSlots = allSlots.filter(s =>
    s.startTime <= now && (s.endTime == null || s.endTime >= now)
  );

  // Auto-detect USKORO competitions (by level lead-day rules)
  const todayDate = new Date(today + "T00:00:00");
  const uskoroComps = uskoro5days.filter(comp => {
    const lead   = USKORO_LEAD_DAYS[comp.level] ?? 1;
    const compDt = new Date(comp.date + "T00:00:00");
    const diffMs = compDt.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 1 && diffDays <= lead;
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Ticker</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Upravljanje live i najava tickerom</p>
        </div>
        <div className="flex items-center gap-2">
          {liveSlots.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--brand-primary)] text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" style={{ animation: "ticker-pulse 1.4s ease-in-out infinite" }} />
              {liveSlots.length} AKTIVAN
            </span>
          )}
          {uskoroComps.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white">
              {uskoroComps.length} USKORO
            </span>
          )}
        </div>
      </div>

      <TickerAdminClient
        competitions={upcomingComps}
        slots={allSlots.map(s => ({
          ...s,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime?.toISOString() ?? null,
        }))}
        disciplines={allDisciplines}
        overrides={overrides.map(o => ({ ...o, createdAt: o.createdAt.toISOString() }))}
        customUpcoming={customUpcoming.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }))}
        liveSlotIds={liveSlots.map(s => s.id)}
        uskoroCompIds={uskoroComps.map(c => c.id)}
        recentArticles={recentArticles.map(a => ({
          id:          a.id,
          title:       a.title,
          slug:        a.slug,
          publishedAt: a.publishedAt,
        }))}
      />
    </div>
  );
}
