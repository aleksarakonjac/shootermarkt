import { db } from "@shootermarkt/db";
import { competitionSchedule, competitions, homepageFocusOverrides, mixedTeamResults, results } from "@shootermarkt/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { effectiveFocusPriority } from "@/lib/competition-priority";
import { isCompetitionLive, rankFocusCandidates, selectHomepageFocusCompetitions, type FocusOverride } from "@/lib/homepage-data";
import { buildCompetitionScopeFilter, type Scope } from "@/lib/scope";

export type FocusPlanItem = {
  id: number;
  name: string;
  date: string;
  dateEnd: string | null;
  level: string;
  priority: number;
  manualPriority: boolean;
  isLive: boolean;
  pinned: boolean;
  collapsed: boolean;
};

export type FocusPlan = {
  /** Zakačeni (pinovi) pa automatski redosled; prvih max(3, pinCount) je na početnoj. */
  order: FocusPlanItem[];
  pinCount: number;
  hidden: FocusPlanItem[];
};

/** Ono što će početna prikazati za scope + ostatak automatskog reda. Ista selekcija kao getHomepageMain. */
export async function getFocusPlan(scope: Scope): Promise<FocusPlan> {
  const today = new Date().toISOString().slice(0, 10);
  const [base, overrides] = await Promise.all([
    db.select().from(competitions)
      .where(and(
        sql`${competitions.date} <= ${today}`,
        sql`(EXISTS (SELECT 1 FROM ${results} WHERE ${results.competitionId} = ${competitions.id}) OR EXISTS (SELECT 1 FROM ${mixedTeamResults} WHERE ${mixedTeamResults.competitionId} = ${competitions.id}))`,
        buildCompetitionScopeFilter(scope),
      ))
      .orderBy(desc(competitions.date)).limit(40),
    db.select({ competitionId: homepageFocusOverrides.competitionId, position: homepageFocusOverrides.position, hidden: homepageFocusOverrides.hidden, collapsed: homepageFocusOverrides.collapsed })
      .from(homepageFocusOverrides).where(eq(homepageFocusOverrides.scope, scope)),
  ]);
  const have = new Set(base.map((c) => c.id));
  const missing = overrides.map((o) => o.competitionId).filter((id) => !have.has(id));
  const extra = missing.length ? await db.select().from(competitions).where(inArray(competitions.id, missing)) : [];
  const candidates = [...base, ...extra];

  const ids = candidates.map((c) => c.id);
  const [scheduleCats, resultCats] = ids.length ? await Promise.all([
    db.selectDistinct({ competitionId: competitionSchedule.competitionId, category: competitionSchedule.category }).from(competitionSchedule).where(inArray(competitionSchedule.competitionId, ids)),
    db.selectDistinct({ competitionId: results.competitionId, category: results.category }).from(results).where(inArray(results.competitionId, ids)),
  ]) : [[], []];
  const cats = new Map<number, Set<string>>();
  for (const r of [...scheduleCats, ...resultCats]) cats.set(r.competitionId, (cats.get(r.competitionId) ?? new Set()).add(r.category));

  const byId = new Map(overrides.map((o) => [o.competitionId, o]));
  const toItem = (c: (typeof candidates)[number]): FocusPlanItem => ({
    id: c.id, name: c.nameSr ?? c.name, date: c.date, dateEnd: c.dateEnd, level: c.level,
    priority: effectiveFocusPriority(c, cats.get(c.id) ?? []), manualPriority: c.focusPriority != null,
    isLive: isCompetitionLive(c.date, c.dateEnd, today),
    pinned: byId.get(c.id)?.position != null && !byId.get(c.id)!.hidden,
    collapsed: byId.get(c.id)?.collapsed ?? false,
  });

  const pinnedList = selectHomepageFocusCompetitions(candidates, today, cats, 0, overrides as FocusOverride[]); // limit 0 = samo pinovi
  const pinnedIds = new Set(pinnedList.map((c) => c.id));
  const hiddenIds = new Set(overrides.filter((o) => o.hidden).map((o) => o.competitionId));
  const rest = rankFocusCandidates(candidates.filter((c) => !pinnedIds.has(c.id) && !hiddenIds.has(c.id)), today, cats).slice(0, 15);
  return {
    order: [...pinnedList, ...rest].map(toItem),
    pinCount: pinnedList.length,
    hidden: candidates.filter((c) => hiddenIds.has(c.id)).map(toItem),
  };
}
