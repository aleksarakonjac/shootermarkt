"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { NOC_LIST } from "@/lib/noc-list";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { useTranslations, useLocale } from "next-intl";

interface Props {
  availableNocs: string[];
  currentQ: string;
  currentZemlja: string;
  currentPol: string;
  currentAparat: string;
  totalCount: number;
  shownCount: number;
  page: number;
  totalPages: number;
}

export function StrelciFilterBar({
  availableNocs,
  currentQ,
  currentZemlja,
  currentPol,
  currentAparat,
  totalCount,
  shownCount,
  page,
  totalPages,
}: Props) {
  const t = useTranslations("shooters");
  const locale = useLocale();

  const GENDER_OPTIONS = [
    ["", t("genderAll")],
    ["M", t("genderMale")],
    ["F", t("genderFemale")],
  ] as const;

  const APARAT_OPTIONS = [
    { value: "",       label: t("aparatAll")     },
    { value: "rifle",  label: t("aparatRifle")   },
    { value: "pistol", label: t("aparatPistol") },
  ] as const;

  const router   = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(currentQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function buildUrl(overrides: {
    q?: string;
    zemlja?: string;
    pol?: string;
    aparat?: string;
    page?: number;
  }) {
    const vals = {
      q:      overrides.q      !== undefined ? overrides.q      : q,
      zemlja: overrides.zemlja !== undefined ? overrides.zemlja : currentZemlja,
      pol:    overrides.pol    !== undefined ? overrides.pol    : currentPol,
      aparat: overrides.aparat !== undefined ? overrides.aparat : currentAparat,
      page:   overrides.page   !== undefined ? overrides.page   : undefined,
    };
    const p = new URLSearchParams();
    if (vals.q)      p.set("q",      vals.q);
    if (vals.zemlja) p.set("zemlja", vals.zemlja);
    if (vals.pol)    p.set("pol",    vals.pol);
    if (vals.aparat) p.set("aparat", vals.aparat);
    if (vals.page && vals.page > 1) p.set("page", String(vals.page));
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function push(overrides: Parameters<typeof buildUrl>[0]) {
    router.replace(buildUrl(overrides));
  }

  function resetFilters() {
    setQ("");
    window.location.assign(buildUrl({ q: "", zemlja: "all", pol: "", aparat: "" }));
  }

  useEffect(() => {
    if (q === currentQ) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ q, page: 1 }), 280);
    return () => clearTimeout(debounceRef.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = !!(currentQ || currentZemlja || currentPol || currentAparat);

  const nocOptions = availableNocs
    .map((noc) => {
      const entry = NOC_LIST.find((n) => n.noc === noc);
      const alpha2 = entry?.alpha2 ?? "";
      return {
        value: noc,
        label: noc,
        sublabel: entry?.name ?? noc,
        prefix: alpha2 ? (
          <span
            className={`fi fi-${alpha2.toLowerCase()}`}
            style={{ fontSize: "1em", borderRadius: "2px", flexShrink: 0 }}
          />
        ) : undefined,
      };
    })
    .sort((a, b) => (a.sublabel ?? "").localeCompare(b.sublabel ?? "", "sr"));

  const pill    = "inline-flex w-full items-center justify-center rounded-md px-1 py-1.5 text-[0.65rem] font-semibold whitespace-nowrap cursor-pointer transition-colors sm:w-auto sm:px-2.5 sm:py-2 sm:text-xs";
  const pillOn  = "bg-[var(--brand-primary)] text-white";
  const pillOff = "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]";

  return (
    <div className="space-y-2 mb-6">

      {/* Search and country stay in the first mobile row. */}
      <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(6.5rem,30%)] items-center gap-1.5 sm:flex">

        {/* Search */}
        <div className="relative min-w-0 sm:flex-1 sm:max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)] pointer-events-none"
            width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
          >
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9 9l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            aria-label="Pretraži strelce"
            className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 py-0 text-xs text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors"
          />
        </div>

        {/* Country */}
        <SearchDropdown
          value={currentZemlja}
          onChange={(v) => push({ zemlja: v || "all", page: 1 })}
          options={nocOptions}
          placeholder="NOC"
          emptyLabel={t("allCountries")}
          searchPlaceholder={t("searchCountry")}
          labelClassName="font-[family-name:var(--font-jetbrains-mono)] font-semibold"
          showSelectedSublabel={false}
          align="right"
          className="w-full sm:w-auto sm:min-w-[130px] [&>button]:h-10"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-6 gap-1 sm:flex sm:items-center sm:flex-wrap sm:gap-1.5">
        {/* Apparatus */}
        <div role="group" aria-label="Filter po disciplini" className="contents">
          {APARAT_OPTIONS.map((a, index) => (
            <button
              key={a.value}
              onClick={() => push({ aparat: a.value, page: 1 })}
              className={`${pill} ${index === APARAT_OPTIONS.length - 1 ? "border-r border-[var(--border-strong)] sm:border-r-0" : ""} ${currentAparat === a.value ? pillOn : pillOff}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <span className="hidden h-4 w-px shrink-0 bg-[var(--border)] sm:block sm:mx-1" aria-hidden="true" />

        {/* Gender */}
        <div role="group" aria-label="Filter po polu" className="contents">
          {GENDER_OPTIONS.map(([val, label]) => (
            <button
              key={val}
              onClick={() => push({ pol: val, page: 1 })}
              className={`${pill} ${currentPol === val ? pillOn : pillOff}`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="hidden h-4 w-px shrink-0 bg-[var(--border)] sm:block sm:mx-1" aria-hidden="true" />

        {isFiltered && (
          <button
            onClick={resetFilters}
            className="col-span-6 justify-self-end text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] px-2.5 py-2 rounded-md hover:bg-[var(--surface)] transition-colors sm:col-auto"
          >
            {t("reset")}
          </button>
        )}

      </div>

      {/* Count + Pagination */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-[var(--muted)]">
          {totalCount === 0 ? (
            t("noResults")
          ) : shownCount < totalCount ? (
            <>
              <span className="font-semibold text-[var(--ink)]">
                {((page - 1) * 50 + 1).toLocaleString(locale)}–{((page - 1) * 50 + shownCount).toLocaleString(locale)}
              </span>
              {` ${t("countOf")} `}
              <span className="font-semibold text-[var(--ink)]">{totalCount.toLocaleString(locale)}</span>
              {` ${t("countShooters")}`}
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--ink)]">{totalCount.toLocaleString(locale)}</span>
              {` ${t("countShooters")}`}
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => push({ page: page - 1 })}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30 transition-colors"
              aria-label={t("prevPage")}
            >
              ←
            </button>
            <span className="text-xs text-[var(--muted)] px-2 font-[family-name:var(--font-jetbrains-mono)]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => push({ page: page + 1 })}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30 transition-colors"
              aria-label={t("nextPage")}
            >
              →
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
