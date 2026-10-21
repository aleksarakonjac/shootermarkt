"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  DISCIPLINE_GROUPS,
  ISSF_LEVEL_GROUP_KEYS,
  LEVEL_GROUPS,
  type DisciplineGroup,
  type LevelGroupKey,
} from "@/lib/competition-filters";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { startNavigationProgress } from "@/components/NavigationProgress";

interface Props {
  availableYears: string[];
  currentYear: string;
  currentLevels: LevelGroupKey[];
  currentDisc: DisciplineGroup[];
  totalCount: number;
  scope: string;
}

const menuButton =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors sm:min-h-9 cursor-pointer";

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-[var(--ink)] bg-[var(--ink)]" : "border-[var(--border-strong)]"}`}
    >
      {on && (
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5.2L4.2 7.4L8 3" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      )}
    </span>
  );
}

/** Padajući meni sa zatvaranjem na klik van i Escape. `count` > 0 znači da je filter aktivan. */
function FilterMenu({ label, value, count, children }: { label: string; value?: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = count > 0;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        className={`${menuButton} ${active ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--ink)]" : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"}`}
      >
        <span>{label}</span>
        {value && <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] tabular-nums">{value}</span>}
        {active && !value && (
          <span className="rounded-full bg-[var(--brand-primary)] px-1.5 py-px font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] leading-4 text-white tabular-nums">{count}</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          className="absolute left-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] w-max min-w-[13rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1 shadow-[0_4px_16px_oklch(0_0_0/0.12)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}

const optionRow =
  "flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm transition-colors hover:bg-[var(--surface-2)] sm:min-h-9 sm:text-xs";

export function CompetitionsFilterBar({
  availableYears,
  currentYear,
  currentLevels,
  currentDisc,
  totalCount,
  scope,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("competition");
  const scopedHref = useScopedHref();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (params: URLSearchParams) => {
      // Promena filtera vraća listu na početak: arhiva i fokus iz kalendara više ne važe.
      params.delete("archiveAll");
      params.delete("focus");
      const qs = params.toString();
      const href = scopedHref(`/takmicenja${qs ? `?${qs}` : ""}`);
      startNavigationProgress(href);
      router.push(href, { scroll: false });
    },
    [router, scopedHref],
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "") params.delete(key);
      else params.set(key, value);
      navigate(params);
    },
    [navigate, searchParams],
  );

  const onSearch = useCallback(
    (v: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setParam("q", v.trim()), 280);
    },
    [setParam],
  );

  const toggle = <T extends string>(key: "level" | "disc", current: readonly T[], value: T) => {
    const next = current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
    // Stari parametri (`tag`, pojedinačni nivoi) se zamenjuju čistim vrednostima.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tag");
    if (next.length) params.set(key, next.join(","));
    else params.delete(key);
    navigate(params);
  };

  const levelKeys = (scope === "issf" ? ISSF_LEVEL_GROUP_KEYS : LEVEL_GROUPS.map((g) => g.key)) as readonly LevelGroupKey[];
  const hasFilters = currentLevels.length > 0 || currentDisc.length > 0 || Boolean(searchParams.get("q")) || currentYear !== String(new Date().getFullYear());

  const levelLabel = (key: LevelGroupKey) => t(`list.levelGroups.${key}`);
  const discLabel = (key: DisciplineGroup) => t(`list.disciplineGroups.${key}`);

  const chips = [
    ...currentLevels.map((key) => ({ id: `level:${key}`, label: levelLabel(key), remove: () => toggle("level", currentLevels, key) })),
    ...currentDisc.map((key) => ({ id: `disc:${key}`, label: discLabel(key), remove: () => toggle("disc", currentDisc, key) })),
  ];

  return (
    <div className="mb-8 space-y-3">
      {/* Desktop (lg+): pretraga, filteri, broj i reset u jednom redu; ispod toga mobilni raspored */}
      <div className="space-y-3 lg:flex lg:items-center lg:gap-3 lg:space-y-0">
      {/* Pretraga + broj rezultata + reset */}
      <div className="flex items-center gap-3 lg:contents">
        <div className="relative max-w-xs flex-1 lg:order-1 lg:w-64 lg:flex-none">
          <svg
            width="14" height="14" viewBox="0 0 14 14"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            defaultValue={searchParams.get("q") ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("list.search")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1.5 pl-8 pr-3 text-base text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none sm:text-sm"
          />
        </div>
        <span className="ml-auto shrink-0 lg:order-3 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--subtle)]">
          {totalCount}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { startNavigationProgress(scopedHref("/takmicenja")); router.push(scopedHref("/takmicenja"), { scroll: false }); }}
            className="min-h-11 shrink-0 px-1 text-xs lg:order-4 text-[var(--muted)] transition-colors hover:text-[var(--brand-primary)] sm:min-h-0"
          >
            {t("list.reset")}
          </button>
        )}
      </div>

      {/* Tri jasne ose: godina (jedan izbor), nivo i disciplina (višestruki izbor) */}
      <div className="flex flex-wrap items-center gap-2 lg:order-2">
        <FilterMenu label={t("list.filterYear")} value={currentYear === "all" ? t("list.allYears") : currentYear} count={currentYear !== String(new Date().getFullYear()) ? 1 : 0}>
          {[{ y: "all", label: t("list.allYears") }, ...availableYears.map((y) => ({ y, label: y }))].map(({ y, label }) => (
            <button
              key={y}
              type="button"
              role="option"
              aria-selected={y === currentYear}
              onClick={() => setParam("year", y === String(new Date().getFullYear()) ? "" : y)}
              className={`${optionRow} ${y === currentYear ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"} font-[family-name:var(--font-jetbrains-mono)]`}
            >
              {label}
            </button>
          ))}
        </FilterMenu>

        <FilterMenu label={t("list.filterLevel")} count={currentLevels.length}>
          {levelKeys.map((key) => {
            const on = currentLevels.includes(key);
            return (
              <button key={key} type="button" role="checkbox" aria-checked={on} onClick={() => toggle("level", currentLevels, key)} className={`${optionRow} ${on ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                <Check on={on} />
                {levelLabel(key)}
              </button>
            );
          })}
        </FilterMenu>

        <FilterMenu label={t("list.filterDiscipline")} count={currentDisc.length}>
          {DISCIPLINE_GROUPS.map((key) => {
            const on = currentDisc.includes(key);
            return (
              <button key={key} type="button" role="checkbox" aria-checked={on} onClick={() => toggle("disc", currentDisc, key)} className={`${optionRow} ${on ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                <Check on={on} />
                {discLabel(key)}
              </button>
            );
          })}
        </FilterMenu>
      </div>
      </div>

      {/* Aktivni filteri kao uklonjivi čipovi */}
      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label={t("list.filterLevel") + " / " + t("list.filterDiscipline")}>
          {chips.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                onClick={chip.remove}
                aria-label={`${t("list.removeFilter")}: ${chip.label}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--border)] sm:min-h-8"
              >
                {chip.label}
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
