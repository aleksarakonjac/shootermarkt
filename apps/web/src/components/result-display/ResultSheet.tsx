"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { displayNoc } from "@shootermarkt/db/noc-list";
import { ShooterAvatar } from "./ShooterAvatar";

/** Building blocks shared by the mobile detail sheets (individual qual/elim, final, mixed team). Large type on purpose: the sheet is the accessible view. */

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]";
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

export function NocChip({ nationality }: { nationality: string | null | undefined }) {
  const noc = nationality ? displayNoc(nationality) : null;
  if (!noc) return null;
  const alpha2 = NOC_LIST.find((n) => n.noc === noc)?.alpha2;
  return (
    <span className={`flex items-center gap-1.5 ${MONO} font-semibold text-[var(--ink)]`}>
      {alpha2 && <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ width: "18px", height: "13px", display: "inline-block" }} />}
      {noc}
    </span>
  );
}

export function SheetPerson({ firstName, lastName, avatarUrl, birthYear, nationality, clubDisplay, en }: {
  firstName: string; lastName: string; avatarUrl?: string | null; birthYear?: number | null; nationality?: string | null; clubDisplay?: string | null; en: boolean;
}) {
  return (
    <div className="flex items-center gap-4 pr-10">
      <ShooterAvatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} size="lg" />
      <div className="min-w-0">
        <h2 aria-live="polite" className="text-xl font-semibold leading-tight text-[var(--ink)] break-words">{lastName} {firstName}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[var(--muted)]">
          {birthYear != null && <span>{en ? "b." : "god."} {birthYear}</span>}
          <NocChip nationality={nationality} />
        </p>
        {clubDisplay && <p className="mt-0.5 text-base text-[var(--muted)] break-words">{clubDisplay}</p>}
      </div>
    </div>
  );
}

export function SheetStats({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className={`mt-5 grid gap-3 text-center ${items.length === 2 ? "grid-cols-2" : items.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-[var(--surface)] px-2 py-3">
          <dt className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{item.label}</dt>
          <dd className={`mt-1 flex items-center justify-center gap-2 text-2xl font-bold tabular-nums text-[var(--ink)] ${MONO}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h3>
      {children}
    </div>
  );
}

/** One value card: label above, main value, optional smaller sub-value (e.g. running total). */
export type SheetCellData = { label?: string; main: string; sub?: string; best?: boolean };

export function SheetCells({ cells, min = "4.25rem" }: { cells: SheetCellData[]; min?: string }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))` }}>
      {cells.map((c, i) => (
        <div key={i} className="rounded-lg px-1 py-2 text-center ring-1 ring-[var(--border)]">
          {c.label && <p className="truncate text-sm font-semibold text-[var(--muted)]">{c.label}</p>}
          <p className={`text-lg tabular-nums ${MONO} ${c.best ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}`}>{c.main}</p>
          {c.sub && <p className={`text-sm tabular-nums text-[var(--muted)] ${MONO}`}>{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

const chev = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/** Scrollable body + sticky footer (prev / profile link / next). `profileHref` omitted → prev/next only (team sheets link each member instead). */
export function SheetFrame({ children, profileHref, profileLabel, onPrev, onNext, en }: {
  children: ReactNode; profileHref?: string; profileLabel?: string; onPrev?: () => void; onNext?: () => void; en: boolean;
}) {
  const navCls = `flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] text-[var(--ink)] aria-disabled:opacity-30 ${FOCUS}`;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-1">{children}</div>
      <div className="flex shrink-0 items-center gap-3 border-t border-[var(--border)] px-5 py-3">
        <button type="button" onClick={onPrev} aria-disabled={!onPrev} aria-label={en ? "Previous" : "Prethodni"} className={navCls}>{chev("M12 4l-6 6 6 6")}</button>
        {profileHref ? (
          <Link href={profileHref} className={`flex h-11 flex-1 items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 text-base font-semibold text-white ${FOCUS}`}>
            {profileLabel ?? (en ? "Shooter profile" : "Profil strelca")}
          </Link>
        ) : <span className="flex-1" />}
        <button type="button" onClick={onNext} aria-disabled={!onNext} aria-label={en ? "Next" : "Sledeći"} className={navCls}>{chev("M8 4l6 6-6 6")}</button>
      </div>
    </>
  );
}

export const sheetProfileLinkCls = `inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-4 text-base font-semibold text-[var(--brand-primary)] ${FOCUS}`;
