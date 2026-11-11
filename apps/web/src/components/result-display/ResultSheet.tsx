"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
        <h2 aria-live="polite" className="text-xl sm:text-lg font-semibold leading-tight text-[var(--ink)] break-words">{lastName} {firstName}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base sm:text-sm text-[var(--muted)]">
          {birthYear != null && <span>{en ? "b." : "god."} {birthYear}</span>}
          <NocChip nationality={nationality} />
        </p>
        {clubDisplay && <p className="mt-0.5 text-base sm:text-sm text-[var(--muted)] break-words">{clubDisplay}</p>}
      </div>
    </div>
  );
}

/** Desktop-only title header for panels without a person (mixed teams); outside the scroll area, always visible. */
export function SheetStickyBar({ title }: { title: string }) {
  return (
    <div className="hidden h-11 shrink-0 items-center rounded-t-[11px] border-b border-[var(--border)] px-3 pr-11 sm:flex">
      <p className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">{title}</p>
    </div>
  );
}

/**
 * Desktop person header that collapses with the panel's scroll: avatar and name shrink, the meta lines fold away and
 * country badge and birth year fade in beside the name — driven by the CSS variable --p (0→1) that SheetFrame sets
 * from the scroll position, so scrolling never re-renders React. It lives OUTSIDE the scroll area (passed as
 * SheetFrame `header`), so the scrollbar starts below it. Its in-flow slot is the collapsed height (44px); the expanded
 * part overlays the top of the scroll area, which reserves the difference with `headerSpace`.
 */
export function SheetPersonDesktop({ firstName, lastName, avatarUrl, birthYear, nationality, clubDisplay, en }: {
  firstName: string; lastName: string; avatarUrl?: string | null; birthYear?: number | null; nationality?: string | null; clubDisplay?: string | null;
  en: boolean;
}) {
  return (
    <div className="relative z-10 hidden h-11 shrink-0 sm:block">
      <div className="absolute left-0 right-1.5 top-0 flex items-center gap-3 rounded-t-[11px] bg-[var(--bg)] px-3 pr-11" style={{ paddingBlock: "calc(12px - 7px * var(--p, 0))", boxShadow: "inset 0 -1px 0 oklch(0 0 0 / calc(var(--p, 0) * 0.1))" }}>
        <div className="shrink-0 overflow-hidden rounded-full" style={{ width: "calc(64px - 34px * var(--p, 0))", height: "calc(64px - 34px * var(--p, 0))" }}>
          <div className="origin-top-left" style={{ width: 80, height: 80, transform: "scale(calc((64 - 34 * var(--p, 0)) / 80))" }}>
            <ShooterAvatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} size="lg" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 aria-live="polite" aria-label={`${lastName} ${firstName}`} className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 font-semibold leading-tight text-[var(--ink)]" style={{ fontSize: "calc(18px - 4px * var(--p, 0))" }}><span className="max-w-full truncate">{lastName}</span><span className="max-w-full truncate">{firstName}</span></h2>
            <span className="flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs" style={{ opacity: "calc(var(--p, 0) * 1.6 - 0.6)", maxWidth: "calc(var(--p, 0) * 110px)" }}><NocChip nationality={nationality} />{birthYear != null && <span className={`text-[var(--muted)] ${MONO}`}>{birthYear}</span>}</span>
          </div>
          <div className="overflow-hidden text-sm text-[var(--muted)]" style={{ maxHeight: "calc(40px * (1 - var(--p, 0)))", opacity: "calc(1 - var(--p, 0) * 1.8)" }}>
            <p className="flex flex-wrap items-center gap-x-2">
              {birthYear != null && <span>{en ? "b." : "god."} {birthYear}</span>}
              <NocChip nationality={nationality} />
            </p>
            {clubDisplay && <p className="truncate">{clubDisplay}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SheetStats({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className={`mt-4 grid gap-2 text-center ${items.length === 2 ? "grid-cols-2" : items.length === 1 ? "grid-cols-1" : items.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col rounded-lg bg-[var(--surface)] px-2 py-1.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{item.label}</dt>
          <dd className={`flex flex-1 items-center justify-center gap-2 text-xl sm:text-lg font-bold leading-tight tabular-nums text-[var(--ink)] ${MONO}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SheetSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-5 space-y-3 sm:mt-4 sm:space-y-2">
      {title && <h3 className="text-sm sm:text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h3>}
      {children}
    </div>
  );
}

/** One compact series chip: optional label, main value. `sub` (e.g. running total) is plain text OUTSIDE the box so it never reads as another series. */
export type SheetCellData = { label?: string; main: string; sub?: string; best?: boolean };

export function SheetCells({ cells, min = "3.5rem" }: { cells: SheetCellData[]; min?: string }) {
  return (
    <div className="grid gap-x-1.5 gap-y-1" style={{ gridTemplateColumns: cells.length <= 6 ? "repeat(3, minmax(0, 1fr))" : `repeat(auto-fit, minmax(${min}, 1fr))` }}>
      {cells.map((c, i) => (
        <div key={i} className="text-center">
          <div className={`rounded-md bg-[var(--surface)] px-1 py-1.5 sm:px-0.5 ring-1 ${c.best ? "ring-2 ring-[var(--brand-primary)]" : "ring-[var(--border-strong)]"}`}>
            {/* <span>, ne <p>: globalno `p { text-wrap: pretty }` (van layer-a) poništava whitespace-nowrap, pa se "Standing 1" lomilo u dva reda. */}
            {c.label && <span className="block whitespace-nowrap text-xs font-semibold leading-tight text-[var(--muted)] sm:text-[0.7rem]">{c.label}</span>}
            <p className={`text-lg leading-tight tabular-nums text-[var(--ink)] sm:text-base ${MONO} ${c.best ? "font-bold" : "font-medium"}`}>{c.main}</p>
          </div>
          {c.sub && <p className={`mt-1 text-sm font-medium tabular-nums text-[var(--muted)] ${MONO}`}>Σ {c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/** Labeled block of series with its subtotal as bold plain text on the header row (stance in 3P, phase in sport pistol, member in mixed). */
export function SheetGroup({ label, subtotal, sub, children }: { label?: string; subtotal?: string; sub?: string; children: ReactNode }) {
  return (
    <div>
      {(label || subtotal) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-1">
          <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
          {subtotal && (
            <p className={`text-lg sm:text-base font-bold tabular-nums text-[var(--ink)] ${MONO}`}>
              {subtotal}{sub && <span className="ml-2 text-sm font-normal text-[var(--muted)]">{sub}</span>}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** Dot plot of series values with a left scale (0.5 steps, or 1 for whole-number scores; widened by doubling when the range would crowd the axis): dots joined by a thin line, dashed line = average, best dot filled. */
export function SheetDots({ values, ariaLabel, line, current, xLabels, picked, onPick, popover }: { values: number[]; ariaLabel: string; line?: number[]; current?: number; xLabels?: [string, string]; picked?: number | null; onPick?: (i: number | null) => void; popover?: ReactNode }) {
  // Tap izvan popovera ili tačke ga zatvara.
  useEffect(() => {
    if (picked == null || !onPick) return;
    const close = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest("[data-dot-popover],[data-dot-btn]")) onPick(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [picked, onPick]);
  if (values.length < 2) return null;
  const all = line ? [...values, ...line] : values;
  const max = Math.max(...all), min = Math.min(...all);
  // Whole-number scoring (air pistol, 3P series sums) → integer axis; decimals (air rifle) → 0.5 steps.
  let step = values.every(Number.isInteger) ? 1 : 0.5;
  const span = (st: number) => Math.ceil(max / st) * st - Math.floor(min / st) * st + 2 * st;
  while (span(step) / step > 7) step *= 2;
  const lo = Math.floor(min / step) * step - step, hi = Math.ceil(max / step) * step + step;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const x = (i: number) => ((i + 0.5) / values.length) * 100;
  return (
    <div role="img" aria-label={ariaLabel} className={`relative ml-11 h-28 sm:h-24 ${xLabels ? "mb-8" : "mb-4"}`}>
      {ticks.map((t) => (
        <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-[var(--border)]" style={{ bottom: `${pct(t)}%` }}>
          <span className={`absolute right-full top-0 mr-1.5 -translate-y-1/2 text-xs tabular-nums text-[var(--subtle)] ${MONO}`}>{t.toFixed(step < 1 ? 1 : 0)}</span>
        </div>
      ))}
      {!line && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--muted)]" style={{ bottom: `${pct(avg)}%` }} />}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {line
          ? <polyline fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={line.map((v, i) => `${x(i)},${100 - pct(v)}`).join(" ")} />
          : <polyline fill="none" stroke="var(--border-strong)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={values.map((v, i) => `${x(i)},${100 - pct(v)}`).join(" ")} />}
      </svg>
      {values.map((v, i) => {
        const filled = current != null ? i === current : v === max;
        const dot = <span className="block size-2.5 rounded-full" style={{ background: filled ? "var(--brand-primary)" : "var(--bg)", boxShadow: `inset 0 0 0 1.5px var(--brand-primary)${picked === i ? ", 0 0 0 3px oklch(0.5 0.2 28 / 0.2)" : ""}` }} />;
        const pos = { left: `${x(i)}%`, bottom: `${pct(v)}%` };
        return onPick ? (
          <button key={i} type="button" data-dot-btn onClick={() => onPick(picked === i ? null : i)} aria-pressed={picked === i} aria-label={`${v}`}
            className="absolute flex size-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]" style={pos}>{dot}</button>
        ) : (
          <span key={i} className="absolute -translate-x-1/2 translate-y-1/2" style={pos}>{dot}</span>
        );
      })}
      {popover && picked != null && (
        <div role="status" data-dot-popover className="absolute z-10 w-56 -translate-x-1/2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] p-2.5 text-sm shadow-lg"
          style={{ left: `clamp(7rem, ${x(picked)}%, calc(100% - 7rem))`, bottom: `calc(${pct((line ? line[picked] : values[picked]) ?? values[picked])}% + 1.25rem)` }}>
          {popover}
        </div>
      )}
      {xLabels && (
        <div className="absolute inset-x-0 top-full mt-1.5 flex justify-between text-xs text-[var(--subtle)]">
          <span>{xLabels[0]}</span><span>{xLabels[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Compact facts strip: one thin full-width box, items share the width equally with hairline dividers. Rank/Total keep the big SheetStats. */
export function SheetFacts({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="mt-3 flex divide-x divide-[var(--border)] rounded-lg ring-1 ring-[var(--border)]">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 flex-1 px-1 py-1.5 text-center">
          <dt className="truncate text-xs text-[var(--muted)]">{it.label}</dt>
          <dd className={`text-base font-semibold leading-tight tabular-nums text-[var(--ink)] ${MONO}`}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const chev = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/** Scrollable body + sticky footer (prev / profile link / next). `profileHref` omitted → prev/next only (team sheets link each member instead). */
export function SheetFrame({ children, profileHref, profileLabel, onPrev, onNext, en, header, headerSpace = 0 }: {
  children: ReactNode; profileHref?: string; profileLabel?: string; onPrev?: () => void; onNext?: () => void; en: boolean;
  /** Desktop header rendered above (outside) the scroll area; it reads `--p` (scroll progress 0→1) set here. */
  header?: ReactNode; headerSpace?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current, sc = scroller.current;
    if (!el || !sc || !header) return;
    // Range = what is scrollable (max 90px): short content still collapses fully at the bottom; ~nothing to scroll stays expanded.
    const update = () => {
      const max = sc.scrollHeight - sc.clientHeight;
      const range = Math.min(90, max);
      el.style.setProperty("--p", String(range < 12 ? 0 : Math.min(1, Math.max(0, sc.scrollTop / range))));
    };
    update();
    sc.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(sc);
    return () => { sc.removeEventListener("scroll", update); ro.disconnect(); };
  }, [header, children]);
  const navCls = `flex h-11 w-11 items-center justify-center sm:h-9 sm:w-9 rounded-lg border border-[var(--border)] text-[var(--ink)] aria-disabled:opacity-30 ${FOCUS}`;
  return (
    <div ref={wrap} className="contents">
      {header}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-1 sm:px-3 sm:pt-0">
        {header && headerSpace > 0 && <div className="hidden sm:block" style={{ height: headerSpace }} aria-hidden="true" />}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-[var(--border)] px-5 py-3 sm:gap-2 sm:px-3 sm:py-2.5">
        <button type="button" onClick={onPrev} aria-disabled={!onPrev} aria-label={en ? "Previous" : "Prethodni"} className={navCls}>{chev("M12 4l-6 6 6 6")}</button>
        {profileHref ? (
          <Link href={profileHref} className={`flex h-11 flex-1 items-center justify-center sm:h-9 rounded-lg bg-[var(--brand-primary)] px-4 text-base sm:text-sm font-semibold text-white ${FOCUS}`}>
            {profileLabel ?? (en ? "Shooter profile" : "Profil strelca")}
          </Link>
        ) : <span className="flex-1" />}
        <button type="button" onClick={onNext} aria-disabled={!onNext} aria-label={en ? "Next" : "Sledeći"} className={navCls}>{chev("M8 4l6 6-6 6")}</button>
      </div>
    </div>
  );
}

/** Desktop detail panel: sticky next to the table, follows the viewport; same content as the mobile sheet. */
export function SheetPanel({ label, onClose, en, children }: { label: string; onClose: () => void; en: boolean; children: ReactNode }) {
  return (
    <aside aria-label={label} className="sticky top-20 hidden max-h-[calc(100dvh-7rem)] w-[20rem] shrink-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-sm sm:flex">
      <button type="button" onClick={onClose} aria-label={en ? "Close" : "Zatvori"} className={`absolute right-1 top-1 z-20 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)] ${FOCUS}`}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
      </button>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}

/**
 * Animated desktop slot for SheetPanel: width grows from 0 (table narrows with it) while the panel
 * fades/slides in. `overflow-x: clip` keeps the panel's sticky positioning working (hidden would not);
 * the slot stretches to the row height so sticky has room to travel. Keeps the last content during close.
 */
export function SheetPanelSlot({ open, label, onClose, en, children }: { open: boolean; label: string; onClose: () => void; en: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const last = useRef<{ label: string; children: ReactNode }>({ label, children });
  if (open) last.current = { label, children };
  const t = { duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <motion.div initial={false} animate={{ width: open ? 332 : 0 }} transition={t} aria-hidden={!open} inert={!open} className="hidden shrink-0 self-stretch [overflow-x:clip] sm:block">
      <motion.div initial={false} animate={{ opacity: open ? 1 : 0, x: open ? 0 : 24 }} transition={t} className="h-full w-[332px] pl-3">
        <SheetPanel label={last.current.label} onClose={onClose} en={en}>{last.current.children}</SheetPanel>
      </motion.div>
    </motion.div>
  );
}

export const sheetProfileLinkCls = `inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-base font-semibold text-[var(--brand-primary)] ${FOCUS}`;
