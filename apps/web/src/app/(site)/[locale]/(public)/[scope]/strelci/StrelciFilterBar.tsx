"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { NOC_LIST } from "@shootermarkt/db/noc-list";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { useTranslations, useLocale } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface Props {
  availableNocs: string[];
  availableBirthYears: number[];
  currentQ: string;
  currentZemlja: string;
  currentZemljaParam: string;
  currentPol: string;
  currentAparat: string;
  currentGodiste: string;
  showSrbPrompt: boolean;
  prioritizeSrb: boolean;
  totalCount: number;
  shownCount: number;
  page: number;
  totalPages: number;
}

export function StrelciFilterBar({
  availableNocs,
  availableBirthYears,
  currentQ,
  currentZemlja,
  currentZemljaParam,
  currentPol,
  currentAparat,
  currentGodiste,
  showSrbPrompt,
  prioritizeSrb,
  totalCount,
  shownCount,
  page,
  totalPages,
}: Props) {
  const t = useTranslations("shooters");
  const locale = useLocale();
  const reducedMotion = useReducedMotion();

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
  const [srbPromptOpen, setSrbPromptOpen] = useState(showSrbPrompt);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function buildUrl(overrides: {
    q?: string;
    zemlja?: string;
    pol?: string;
    aparat?: string;
    godiste?: string;
    page?: number;
  }) {
    const vals = {
      q:      overrides.q      !== undefined ? overrides.q      : q,
      zemlja: overrides.zemlja !== undefined ? overrides.zemlja : currentZemljaParam,
      pol:    overrides.pol    !== undefined ? overrides.pol    : currentPol,
      aparat: overrides.aparat !== undefined ? overrides.aparat : currentAparat,
      godiste: overrides.godiste !== undefined ? overrides.godiste : currentGodiste,
      page:   overrides.page   !== undefined ? overrides.page   : undefined,
    };
    const p = new URLSearchParams();
    if (vals.q)      p.set("q",      vals.q);
    if (vals.zemlja) p.set("zemlja", vals.zemlja);
    if (vals.pol)    p.set("pol",    vals.pol);
    if (vals.aparat) p.set("aparat", vals.aparat);
    if (/^\d{4}$/.test(vals.godiste)) p.set("godiste", vals.godiste);
    if (vals.page && vals.page > 1) p.set("page", String(vals.page));
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function push(overrides: Parameters<typeof buildUrl>[0]) {
    router.replace(buildUrl(overrides));
  }

  function resetFilters() {
    setQ("");
    push({ q: "", zemlja: "all", pol: "", aparat: "", godiste: "" });
  }

  useEffect(() => {
    if (q === currentQ) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ q, page: 1 }), 280);
    return () => clearTimeout(debounceRef.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = !!(currentQ || currentZemlja || currentPol || currentAparat || currentGodiste);

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
    .sort((a, b) => prioritizeSrb && a.value === "SRB" ? -1 : prioritizeSrb && b.value === "SRB" ? 1 : (a.sublabel ?? "").localeCompare(b.sublabel ?? "", "sr"));

  const birthYearOptions = availableBirthYears.map((year) => ({ value: String(year), label: String(year) }));

  const pill    = "inline-flex w-full items-center justify-center rounded-md px-1 py-1.5 text-[0.65rem] font-semibold whitespace-nowrap cursor-pointer transition-colors sm:w-auto sm:px-2.5 sm:py-2 sm:text-xs";
  const pillOn  = "bg-[var(--brand-primary)] text-white";
  const pillOff = "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]";

  return (
    <div className="space-y-2 mb-6">

      {/* Search and country stay in the first mobile row. */}
      <div className="flex w-full items-center gap-1.5">

        {/* Search */}
        <div className="relative min-w-0 flex-1 sm:max-w-[14rem]">
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
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 py-0 text-xs text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors"
          />
        </div>

        {/* Country */}
        <div className="relative w-24 shrink-0 sm:w-auto sm:min-w-[150px]">
          <AnimatePresence>
            {srbPromptOpen && (
              <motion.div
                className="absolute bottom-[calc(100%+0.5rem)] right-0 z-[var(--z-dropdown)] w-60 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 shadow-lg"
                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: 4 }}
                transition={{ duration: reducedMotion ? 0 : 0.16 }}
              >
                <button type="button" onClick={() => setSrbPromptOpen(false)} className="absolute right-2 top-0.5 flex h-7 w-7 items-center justify-center text-lg leading-none text-[var(--subtle)] hover:text-[var(--ink)]" aria-label="Zatvori">×</button>
                <p className="flex items-center gap-1.5 pr-4 text-xs font-medium text-[var(--ink)]">
                  <span className="fi fi-rs shrink-0" style={{ width: "16px", height: "12px", borderRadius: "2px" }} aria-hidden="true" />
                  Prikaži samo strelce Srbije?
                </p>
                <button
                  type="button"
                  onClick={() => { setSrbPromptOpen(false); push({ zemlja: "SRB", page: 1 }); }}
                  className="mt-2 text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                >
                  Prikaži Srbiju
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <SearchDropdown
            value={currentZemlja}
            onChange={(v) => { setSrbPromptOpen(false); push({ zemlja: v || "all", page: 1 }); }}
            options={nocOptions}
            placeholder="NOC"
            emptyLabel={t("allCountries")}
            showEmptyOption={false}
            searchPlaceholder={t("searchCountry")}
            labelClassName="font-[family-name:var(--font-jetbrains-mono)] font-semibold"
            showSelectedSublabel={false}
            align="right"
            animated
            pinnedValues={prioritizeSrb ? ["SRB"] : []}
            className="w-full [&>button]:h-9"
          />
        </div>

        <SearchDropdown
          value={currentGodiste}
          onChange={(value) => push({ godiste: value, page: 1 })}
          options={birthYearOptions}
          placeholder={t("profile.birthYear")}
          emptyLabel={t("profile.birthYear")}
          showEmptyOption={false}
          searchable={false}
          align="right"
          animated
          className="w-20 shrink-0 [&>button]:h-9 [&>button]:px-2 [&>button]:text-xs sm:w-32"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-6 gap-1 sm:flex sm:items-center sm:flex-wrap sm:gap-1.5">
        {/* Apparatus */}
        <div role="group" aria-label="Filter po disciplini" className="contents">
          {APARAT_OPTIONS.map((a, index) => (
            <motion.button
              key={a.value}
              onClick={() => push({ aparat: a.value, page: 1 })}
              className={`${pill} ${index === APARAT_OPTIONS.length - 1 ? "border-r border-[var(--border-strong)] sm:border-r-0" : ""} ${currentAparat === a.value ? pillOn : pillOff}`}
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              transition={{ duration: 0.12 }}
            >
              {a.label}
            </motion.button>
          ))}
        </div>

        <span className="hidden h-4 w-px shrink-0 bg-[var(--border)] sm:block sm:mx-1" aria-hidden="true" />

        {/* Gender */}
        <div role="group" aria-label="Filter po polu" className="contents">
          {GENDER_OPTIONS.map(([val, label]) => (
            <motion.button
              key={val}
              onClick={() => push({ pol: val, page: 1 })}
              className={`${pill} ${currentPol === val ? pillOn : pillOff}`}
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              transition={{ duration: 0.12 }}
            >
              {label}
            </motion.button>
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
