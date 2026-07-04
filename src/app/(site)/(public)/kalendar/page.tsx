import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { KalendarClient, type CalendarComp } from "./KalendarClient";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

export const metadata: Metadata = { title: "Kalendar takmičenja" };

export default async function KalendarPage() {
  const rows = await db
    .select({
      id:      competitions.id,
      name:    competitions.name,
      date:    competitions.date,
      dateEnd: competitions.dateEnd,
      location: competitions.location,
      level:   competitions.level,
    })
    .from(competitions)
    .orderBy(asc(competitions.date));

  const comps: CalendarComp[] = rows.map((r) => ({
    id:       r.id,
    name:     r.name,
    date:     r.date,
    dateEnd:  r.dateEnd ?? null,
    location: r.location ?? null,
    level:    r.level as CompetitionLevel,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-8">
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">
          Početna
        </Link>
        <span className="text-[var(--subtle)]">/</span>
        <span className="text-[var(--ink)] font-medium">Kalendar</span>
      </nav>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          Kalendar takmičenja
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1.5 max-w-[55ch]">
          Pregled svih takmičenja po datumu. Klikni na dan za detalje.
        </p>
      </div>

      {/* ── Calendar + list ─────────────────────────────────────── */}
      {comps.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
          <p className="text-sm font-medium text-[var(--muted)]">Još nema unetih takmičenja.</p>
        </div>
      ) : (
        <KalendarClient competitions={comps} />
      )}
    </div>
  );
}
