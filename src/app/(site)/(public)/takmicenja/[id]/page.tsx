export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  competitions,
  results,
  shooters,
  clubs,
  disciplines,
  countries,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { CompetitionLevel, EventType } from "@/lib/pdf-import/types";
import {
  CompetitionResultsClient,
  type DisciplineGroup,
} from "./CompetitionResultsClient";

type Props = { params: Promise<{ id: string }> };

// ── Labels ────────────────────────────────────────────────────────────────────

const LEVEL_META: Record<
  CompetitionLevel,
  { label: string; bg: string; color: string }
> = {
  club:          { label: "Klubsko",        bg: "var(--surface-2)",           color: "var(--muted)"         },
  regional:      { label: "Regionalno",     bg: "var(--brand-accent)",        color: "white"                },
  national:      { label: "Državno",        bg: "var(--success)",             color: "white"                },
  international: { label: "Međunarodno",    bg: "oklch(0.52 0.15 220)",       color: "white"                },
  continental:   { label: "Kontinentalno",  bg: "oklch(0.62 0.18 55)",        color: "white"                },
  world:         { label: "ISSF–Svetsko",   bg: "var(--brand-primary)",       color: "white"                },
  olympic:       { label: "Olimpijsko",     bg: "oklch(0.65 0.18 75)",        color: "white"                },
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  championship:    "Šampionat",
  world_cup:       "Svetski kup",
  champions_league:"Čempionska liga",
  cup:             "Kup",
  grand_prix:      "Grand prix",
  league_round:    "Kolo lige",
  friendly:        "Prijateljsko",
  other:           "",
};

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const comp = await db.query.competitions.findFirst({
    where: eq(competitions.id, parseInt(id)),
  });
  if (!comp) return { title: "Takmičenje nije pronađeno" };
  return { title: comp.name };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CompetitionPage({ params }: Props) {
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
      nationality: shooters.nationality,
      clubId: results.clubId,
      clubName: clubs.name,
      clubNocCode: clubs.nocCode,
      disciplineCode: disciplines.code,
      disciplineId: disciplines.id,
      disciplineName: disciplines.name,
      apparatus: disciplines.apparatus,
      qualTotal: results.qualTotal,
      qualRank: results.qualRank,
      qualInners: results.qualInners,
      qualified: results.qualified,
      qualDetail: results.qualDetail,
      finalTotal: results.finalTotal,
      finalRank: results.finalRank,
      finalDetail: results.finalDetail,
    })
    .from(results)
    .innerJoin(shooters, eq(results.shooterId, shooters.id))
    .leftJoin(clubs, eq(results.clubId, clubs.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(eq(results.competitionId, compId))
    .orderBy(asc(results.qualRank));

  // Group by discipline preserving order of first appearance
  const disciplineOrder: string[] = [];
  const disciplineMap = new Map<string, DisciplineGroup>();

  for (const r of compResults) {
    if (!disciplineMap.has(r.disciplineCode)) {
      disciplineOrder.push(r.disciplineCode);
      disciplineMap.set(r.disciplineCode, {
        code: r.disciplineCode,
        name: r.disciplineName,
        apparatus: r.apparatus,
        results: [],
      });
    }
    disciplineMap.get(r.disciplineCode)!.results.push({
      id: r.id,
      shooterId: r.shooterId,
      firstName: r.firstName,
      lastName: r.lastName,
      nationality: r.nationality,
      clubName: r.clubName ?? null,
      clubNocCode: r.clubNocCode ?? null,
      qualTotal: r.qualTotal,
      qualRank: r.qualRank,
      qualInners: r.qualInners,
      qualified: r.qualified,
      qualDetail: r.qualDetail,
      finalTotal: r.finalTotal,
      finalRank: r.finalRank,
      finalDetail: r.finalDetail,
    });
  }

  const groups = disciplineOrder.map((code) => disciplineMap.get(code)!);

  // ── Date display ────────────────────────────────────────────────
  const dateDisplay = comp.dateEnd && comp.dateEnd !== comp.date
    ? `${comp.date} – ${comp.dateEnd}`
    : comp.date;

  const levelMeta = LEVEL_META[comp.level as CompetitionLevel];
  const eventTypeLabel = EVENT_TYPE_LABELS[comp.eventType as EventType] ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-8">
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">
          Početna
        </Link>
        <span className="text-[var(--subtle)]">/</span>
        <Link href="/takmicenja" className="hover:text-[var(--ink)] transition-colors">
          Takmičenja
        </Link>
        <span className="text-[var(--subtle)]">/</span>
        <span className="text-[var(--ink)] font-medium truncate max-w-[260px]">
          {comp.name}
        </span>
      </nav>

      {/* ── Competition header ────────────────────────────────────── */}
      <div className="mb-8 pb-8 border-b border-[var(--border)]">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-[0.7rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide"
            style={{ background: levelMeta.bg, color: levelMeta.color }}
          >
            {levelMeta.label}
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
          {comp.name}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[var(--subtle)]" aria-hidden="true">
              <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 6h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">
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
              {comp.location && <span>{comp.location}</span>}
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

      {/* ── Results ───────────────────────────────────────────────── */}
      <div>
        <h2
          className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase tracking-tight text-[var(--ink)] mb-5"
          style={{ fontSize: "1.25rem", letterSpacing: "-0.02em" }}
        >
          Rezultati
        </h2>
        <CompetitionResultsClient groups={groups} />
      </div>
    </div>
  );
}
