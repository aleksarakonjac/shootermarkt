export const revalidate = 300;

import { db } from "@shootermarkt/db";
import {
  competitions,
  results,
  shooters,
  clubs,
  disciplines,
  mixedTeamResults,
  competitionSchedule,
} from "@shootermarkt/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ScopedLink } from "../../../components/ScopedLink";
import type { EventType } from "@shootermarkt/db/pdf-import-types";
import { CATEGORY_RANK } from "@shootermarkt/db/pdf-import-types";
import { LEVEL_STYLE, getLevelLabel } from "@/lib/competition-utils";
import {
  CompetitionResultsClient,
  type DisciplineGroup,
} from "./CompetitionResultsClient";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import type { Scope } from "@/lib/scope";
import { RelatedNewsSection } from "@/components/RelatedNewsSection";
import { ScheduleSection, type ScheduleSlot } from "./ScheduleSection";
import { matchShooter } from "@shootermarkt/db/name-match";
import { splitDisplayName } from "@shootermarkt/adapters/sius/public-adapter";

type Props = { params: Promise<{ id: string; scope: Scope }> };

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const { id, scope } = await params;
  const comp = await db.query.competitions.findFirst({
    where: eq(competitions.id, parseInt(id)),
  });
  const alternates = buildAlternates(locale, scope, `/takmicenja/${id}`);
  if (!comp) {
    const t = await getTranslations("competition");
    return { title: t("detail.notFound"), alternates };
  }
  const name = locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name);
  return { title: name, alternates };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CompetitionPage({ params }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("competition");
  const tCommon = await getTranslations("common");

  const { id } = await params;
  const compId = parseInt(id);
  if (isNaN(compId)) notFound();

  const comp = await db.query.competitions.findFirst({
    where: eq(competitions.id, compId),
    with: { country: true },
  });
  if (!comp) notFound();

  // Fetch all results for this competition
  const compResults = await db
    .select({
      id: results.id,
      shooterId: results.shooterId,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      birthYear: shooters.birthYear,
      nationality: shooters.nationality,
      avatarUrl: shooters.avatarUrl,
      clubId: results.clubId,
      clubName: clubs.name,
      clubNocCode: clubs.nocCode,
      disciplineCode: disciplines.code,
      disciplineId: disciplines.id,
      disciplineName: disciplines.name,
      apparatus: disciplines.apparatus,
      category: results.category,
      elimRound: results.elimRound,
      elimTotal: results.elimTotal,
      elimRank: results.elimRank,
      elimDetail: results.elimDetail,
      elimRemark: results.elimRemark,
      qualTotal: results.qualTotal,
      qualRank: results.qualRank,
      qualInners: results.qualInners,
      qualified: results.qualified,
      qualDetail: results.qualDetail,
      qualRemark: results.qualRemark,
      finalTotal: results.finalTotal,
      finalRank: results.finalRank,
      finalDetail: results.finalDetail,
      finalRemark: results.finalRemark,
    })
    .from(results)
    .innerJoin(shooters, eq(results.shooterId, shooters.id))
    .leftJoin(clubs, eq(results.clubId, clubs.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(eq(results.competitionId, compId))
    .orderBy(asc(results.qualRank));

  // Mixed team results
  const mixedResults = await db
    .select({
      id: mixedTeamResults.id,
      disciplineCode: disciplines.code,
      disciplineName: disciplines.name,
      apparatus: disciplines.apparatus,
      nocCode: mixedTeamResults.nocCode,
      teamNumber: mixedTeamResults.teamNumber,
      shooter1Id: mixedTeamResults.shooter1Id,
      shooter2Id: mixedTeamResults.shooter2Id,
      shooter1Name: mixedTeamResults.shooter1Name,
      shooter2Name: mixedTeamResults.shooter2Name,
      shooter1Detail: mixedTeamResults.shooter1Detail,
      shooter2Detail: mixedTeamResults.shooter2Detail,
      qualRank: mixedTeamResults.qualRank,
      qualTotal: mixedTeamResults.qualTotal,
      qualInners: mixedTeamResults.qualInners,
      qualRemark: mixedTeamResults.qualRemark,
      qualified: mixedTeamResults.qualified,
      finalRank: mixedTeamResults.finalRank,
      finalTotal: mixedTeamResults.finalTotal,
      finalRemark: mixedTeamResults.finalRemark,
      shooter1FinalDetail: mixedTeamResults.shooter1FinalDetail,
      shooter2FinalDetail: mixedTeamResults.shooter2FinalDetail,
    })
    .from(mixedTeamResults)
    .innerJoin(disciplines, eq(mixedTeamResults.disciplineId, disciplines.id))
    .where(eq(mixedTeamResults.competitionId, compId))
    .orderBy(asc(mixedTeamResults.qualRank));

  // SIUS import often can't match international athletes to an ISSF id at commit time —
  // fall back to a name+nation match against our shooters table so the profile link still works.
  const needsShooterMatch = mixedResults.some(
    (r) => (!r.shooter1Id && r.shooter1Name) || (!r.shooter2Id && r.shooter2Name)
  );
  if (needsShooterMatch) {
    const allShootersLite = await db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
      .from(shooters);
    for (const r of mixedResults) {
      if (!r.shooter1Id && r.shooter1Name) {
        const { firstName, lastName } = splitDisplayName(r.shooter1Name);
        const match = matchShooter(firstName, lastName, r.nocCode, allShootersLite);
        if (match.kind === "exact") r.shooter1Id = match.id;
      }
      if (!r.shooter2Id && r.shooter2Name) {
        const { firstName, lastName } = splitDisplayName(r.shooter2Name);
        const match = matchShooter(firstName, lastName, r.nocCode, allShootersLite);
        if (match.kind === "exact") r.shooter2Id = match.id;
      }
    }
  }

  // Fetch schedule slots
  const scheduleRows = await db
    .select({
      id: competitionSchedule.id,
      disciplineCode: disciplines.code,
      stage: competitionSchedule.stage,
      category: competitionSchedule.category,
      startTime: competitionSchedule.startTime,
      endTime: competitionSchedule.endTime,
    })
    .from(competitionSchedule)
    .innerJoin(disciplines, eq(competitionSchedule.disciplineId, disciplines.id))
    .where(eq(competitionSchedule.competitionId, compId))
    .orderBy(asc(competitionSchedule.startTime));

  const scheduleSlots: ScheduleSlot[] = scheduleRows.map((r) => ({
    id: r.id,
    disciplineCode: r.disciplineCode,
    stage: r.stage,
    category: r.category,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime?.toISOString() ?? null,
  }));

  // Group mixed team results by discipline code
  const mixedGroupOrder: string[] = [];
  const mixedGroupMap = new Map<string, { code: string; name: string; apparatus: string | null; teams: typeof mixedResults }>();
  for (const r of mixedResults) {
    if (!mixedGroupMap.has(r.disciplineCode)) {
      mixedGroupOrder.push(r.disciplineCode);
      mixedGroupMap.set(r.disciplineCode, { code: r.disciplineCode, name: r.disciplineName, apparatus: r.apparatus, teams: [] });
    }
    mixedGroupMap.get(r.disciplineCode)!.teams.push(r);
  }
  const mixedGroups = mixedGroupOrder.map((code) => mixedGroupMap.get(code)!);

  // Group by discipline, then by age category, preserving order of first appearance
  const disciplineOrder: string[] = [];
  const disciplineMap = new Map<string, DisciplineGroup>();
  const categoryOrder = new Map<string, string[]>(); // disciplineCode -> category[]
  const categoryMap = new Map<string, Map<string, DisciplineGroup["categories"][number]>>();

  for (const r of compResults) {
    if (!disciplineMap.has(r.disciplineCode)) {
      disciplineOrder.push(r.disciplineCode);
      disciplineMap.set(r.disciplineCode, {
        code: r.disciplineCode,
        name: r.disciplineName,
        apparatus: r.apparatus,
        categories: [],
      });
      categoryOrder.set(r.disciplineCode, []);
      categoryMap.set(r.disciplineCode, new Map());
    }

    const catsForDiscipline = categoryOrder.get(r.disciplineCode)!;
    const catMapForDiscipline = categoryMap.get(r.disciplineCode)!;
    if (!catMapForDiscipline.has(r.category)) {
      catsForDiscipline.push(r.category);
      catMapForDiscipline.set(r.category, { category: r.category, results: [] });
    }

    catMapForDiscipline.get(r.category)!.results.push({
      id: r.id,
      shooterId: r.shooterId,
      firstName: r.firstName,
      lastName: r.lastName,
      birthYear: r.birthYear,
      nationality: r.nationality,
      avatarUrl: r.avatarUrl,
      clubName: r.clubName ?? null,
      clubNocCode: r.clubNocCode ?? null,
      elimRound: r.elimRound,
      elimTotal: r.elimTotal,
      elimRank: r.elimRank,
      elimDetail: r.elimDetail,
      elimRemark: r.elimRemark,
      qualTotal: r.qualTotal,
      qualRank: r.qualRank,
      qualInners: r.qualInners,
      qualified: r.qualified,
      qualDetail: r.qualDetail,
      qualRemark: r.qualRemark,
      finalTotal: r.finalTotal,
      finalRank: r.finalRank,
      finalDetail: r.finalDetail,
      finalRemark: r.finalRemark,
    });
  }

  const groups = disciplineOrder.map((code) => {
    const catMapForDiscipline = categoryMap.get(code)!;
    const cats = categoryOrder
      .get(code)!
      .map((cat) => catMapForDiscipline.get(cat)!)
      .sort((a, b) => CATEGORY_RANK[b.category] - CATEGORY_RANK[a.category]); // stariji prvo
    return { ...disciplineMap.get(code)!, categories: cats };
  });

  // ── Date display ────────────────────────────────────────────────
  function fmtDate(d: string) {
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}.`;
  }
  const dateDisplay = comp.dateEnd && comp.dateEnd !== comp.date
    ? `${fmtDate(comp.date)} – ${fmtDate(comp.dateEnd)}`
    : fmtDate(comp.date);

  const levelStyle = LEVEL_STYLE[comp.level] ?? { background: "#f3f4f6", color: "#4b5563" };
  const levelLabel = getLevelLabel(comp.level, locale);

  // Event type labels (localized)
  const EVENT_TYPE_LABELS: Record<string, string> = locale === "en"
    ? {
        championship:     "Championship",
        world_cup:        "World Cup",
        champions_league: "Champions League",
        cup:              "Cup",
        grand_prix:       "Grand Prix",
        league_round:     "League Round",
        friendly:         "Friendly",
        other:            "",
      }
    : {
        championship:     "Šampionat",
        world_cup:        "Svetski kup",
        champions_league: "Čempionska liga",
        cup:              "Kup",
        grand_prix:       "Grand prix",
        league_round:     "Kolo lige",
        friendly:         "Prijateljsko",
        other:            "",
      };

  const eventTypeLabel = EVENT_TYPE_LABELS[comp.eventType as EventType] ?? "";

  // Localized competition name
  const compName = locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-8">
        <ScopedLink href="/" className="hover:text-[var(--ink)] transition-colors">
          {tCommon("home")}
        </ScopedLink>
        <span className="text-[var(--subtle)]">/</span>
        <ScopedLink href="/takmicenja" className="hover:text-[var(--ink)] transition-colors">
          {t("list.title")}
        </ScopedLink>
        <span className="text-[var(--subtle)]">/</span>
        <span className="text-[var(--ink)] font-medium truncate max-w-[260px]">
          {compName}
        </span>
      </nav>

      {/* ── Competition header ────────────────────────────────────── */}
      <div className="mb-8 pb-8 border-b border-[var(--border)]">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-[0.7rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide"
            style={levelStyle}
          >
            {levelLabel}
          </span>
          {eventTypeLabel && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[0.7rem] font-semibold bg-[var(--surface-2)] text-[var(--muted)] font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide">
              {eventTypeLabel}
            </span>
          )}
          {comp.organizer && (
            <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">
              {comp.organizer}
            </span>
          )}
        </div>

        {/* Title */}
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)] mb-3"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {compName}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[var(--subtle)]" aria-hidden="true">
              <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 6h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs translate-y-0.5">
              {dateDisplay}
            </span>
          </span>
          {(comp.location || comp.country) && (
            <span className="flex items-center gap-1.5">
              <svg width="12" height="13" viewBox="0 0 12 14" fill="none" className="shrink-0 text-[var(--subtle)]" aria-hidden="true">
                <path d="M6 1C3.79 1 2 2.79 2 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <circle cx="6" cy="5" r="1.3" fill="currentColor"/>
              </svg>
              {comp.country?.code2 && (
                <span
                  className={`fi fi-${comp.country.code2.toLowerCase()} shrink-0`}
                  style={{ width: "16px", height: "11px", borderRadius: "2px", display: "inline-block" }}
                />
              )}
              {comp.location && <span>{(locale === "en" ? (comp.locationEn ?? comp.location) : (comp.locationSr ?? comp.location))}</span>}
              {comp.country && comp.location && (
                <span className="text-[var(--subtle)]">· {comp.country.name}</span>
              )}
              {comp.country && !comp.location && (
                <span>{comp.country.name}</span>
              )}
            </span>
          )}
          {groups.length > 0 && (
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[var(--subtle)]" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="7" cy="7" r="0.7" fill="currentColor"/>
              </svg>
              <span>{groups.map((g) => g.code).join(" · ")}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Schedule ─────────────────────────────────────────────── */}
      <ScheduleSection slots={scheduleSlots} locale={locale} timezone={comp.timezone ?? "UTC"} />

      {/* ── Results ───────────────────────────────────────────────── */}
      <div>
        <h2
          className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase tracking-tight text-[var(--ink)] mb-5"
          style={{ fontSize: "1.5rem", letterSpacing: "-0.02em" }}
        >
          {t("detail.results")}
        </h2>
        <CompetitionResultsClient groups={groups} mixedGroups={mixedGroups} competitionId={comp.id} locale={locale} competitionLevel={comp.level} />
      </div>

      <RelatedNewsSection type="competition" refId={compId} locale={locale} />
    </div>
  );
}
