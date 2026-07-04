"use client";

import { useEffect, useRef, useState } from "react";

// ── Data ───────────────────────────────────────────────────────────────────────

interface Country {
  noc: string;   // ISSF/shooting 3-letter code
  alpha2: string; // ISO 3166-1 alpha-2 for flag emoji
  name: string;
}

interface CountryGroup {
  continent: string;
  countries: Country[];
}

const COUNTRY_GROUPS: CountryGroup[] = [
  {
    continent: "Balkan i okruženje",
    countries: [
      { noc: "SRB", alpha2: "RS", name: "Srbija" },
      { noc: "HRV", alpha2: "HR", name: "Hrvatska" },
      { noc: "BIH", alpha2: "BA", name: "Bosna i Hercegovina" },
      { noc: "MNE", alpha2: "ME", name: "Crna Gora" },
      { noc: "SVN", alpha2: "SI", name: "Slovenija" },
      { noc: "MKD", alpha2: "MK", name: "Severna Makedonija" },
      { noc: "ALB", alpha2: "AL", name: "Albanija" },
      { noc: "ROU", alpha2: "RO", name: "Rumunija" },
      { noc: "BGR", alpha2: "BG", name: "Bugarska" },
      { noc: "HUN", alpha2: "HU", name: "Mađarska" },
    ],
  },
  {
    continent: "Zapadna Evropa",
    countries: [
      { noc: "GER", alpha2: "DE", name: "Nemačka" },
      { noc: "AUT", alpha2: "AT", name: "Austrija" },
      { noc: "ITA", alpha2: "IT", name: "Italija" },
      { noc: "FRA", alpha2: "FR", name: "Francuska" },
      { noc: "ESP", alpha2: "ES", name: "Španija" },
      { noc: "POR", alpha2: "PT", name: "Portugal" },
      { noc: "BEL", alpha2: "BE", name: "Belgija" },
      { noc: "NED", alpha2: "NL", name: "Holandija" },
      { noc: "SUI", alpha2: "CH", name: "Švajcarska" },
      { noc: "GBR", alpha2: "GB", name: "Velika Britanija" },
    ],
  },
  {
    continent: "Severna i Istočna Evropa",
    countries: [
      { noc: "NOR", alpha2: "NO", name: "Norveška" },
      { noc: "SWE", alpha2: "SE", name: "Švedska" },
      { noc: "FIN", alpha2: "FI", name: "Finska" },
      { noc: "DEN", alpha2: "DK", name: "Danska" },
      { noc: "POL", alpha2: "PL", name: "Poljska" },
      { noc: "CZE", alpha2: "CZ", name: "Češka" },
      { noc: "SVK", alpha2: "SK", name: "Slovačka" },
      { noc: "GRE", alpha2: "GR", name: "Grčka" },
      { noc: "UKR", alpha2: "UA", name: "Ukrajina" },
      { noc: "BLR", alpha2: "BY", name: "Belorusija" },
    ],
  },
  {
    continent: "Azija",
    countries: [
      { noc: "CHN", alpha2: "CN", name: "Kina" },
      { noc: "KOR", alpha2: "KR", name: "Južna Koreja" },
      { noc: "IND", alpha2: "IN", name: "Indija" },
      { noc: "JPN", alpha2: "JP", name: "Japan" },
      { noc: "KAZ", alpha2: "KZ", name: "Kazahstan" },
      { noc: "UZB", alpha2: "UZ", name: "Uzbekistan" },
      { noc: "IRN", alpha2: "IR", name: "Iran" },
      { noc: "THA", alpha2: "TH", name: "Tajland" },
    ],
  },
  {
    continent: "Amerika i Okeanija",
    countries: [
      { noc: "USA", alpha2: "US", name: "SAD" },
      { noc: "CAN", alpha2: "CA", name: "Kanada" },
      { noc: "BRA", alpha2: "BR", name: "Brazil" },
      { noc: "MEX", alpha2: "MX", name: "Meksiko" },
      { noc: "AUS", alpha2: "AU", name: "Australija" },
    ],
  },
];

const ALL_COUNTRIES: Country[] = COUNTRY_GROUPS.flatMap((g) => g.countries);

// ── Helpers ────────────────────────────────────────────────────────────────────

function flagEmoji(alpha2: string): string {
  return alpha2
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1f1e6))
    .join("");
}

// Countries with data in the system — only SRB for now
const AVAILABLE_COUNTRIES = new Set(["SRB"]);

type Scope = "issf" | "esc" | string; // string = country NOC

const PRESETS: { key: Scope; label: string; icon: React.ReactNode }[] = [
  {
    key: "issf",
    label: "ISSF",
    icon: <img src="/logos/issf.svg" alt="" aria-hidden="true" className="h-7 w-auto max-w-[4rem] object-contain" />,
  },
  {
    key: "esc",
    label: "ESC",
    icon: <img src="/logos/esc.png" alt="" aria-hidden="true" className="h-7 w-auto max-w-[4rem] object-contain" />,
  },
];

function scopeLabel(scope: Scope): string {
  if (scope === "issf") return "ISSF";
  if (scope === "esc") return "ESC";
  const country = ALL_COUNTRIES.find((c) => c.noc === scope);
  return country ? country.name : scope;
}

function scopeIcon(scope: Scope): React.ReactNode {
  if (scope === "issf") return <img src="/logos/issf.svg" alt="" aria-hidden="true" className="h-4 w-auto max-w-[2rem] object-contain" />;
  if (scope === "esc") return <img src="/logos/esc.png" alt="" aria-hidden="true" className="h-4 w-auto max-w-[2rem] object-contain" />;
  const country = ALL_COUNTRIES.find((c) => c.noc === scope);
  if (country) return <span aria-hidden="true" className="text-base leading-none">{flagEmoji(country.alpha2)}</span>;
  return null;
}

// ── Storage key ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "shootermarkt_scope";

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  /** compact = trigger label hidden, only icon shown */
  compact?: boolean;
  /** placement = which direction the panel opens */
  placement?: "bottom" | "top";
}

export function RegionSelector({ compact = false, placement = "bottom" }: Props) {
  const [scope, setScope] = useState<Scope>("SRB");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage — validate saved value is still valid
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const valid = saved === "issf" || saved === "esc" || ALL_COUNTRIES.some((c) => c.noc === saved);
      if (valid) setScope(saved as Scope);
    } catch {}
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, scope); } catch {}
  }, [scope]);

  // Focus search when panel opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch("");
  }, [open]);

  // Click outside & ESC
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function select(s: Scope) {
    setScope(s);
    setOpen(false);
  }

  // Filtered countries for search
  const filtered = search
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.noc.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* ── Trigger ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Opseg: ${scopeLabel(scope)}`}
        className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-colors px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] ${
          open ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]" : ""
        }`}
      >
        {scopeIcon(scope)}
        {!compact && (
          <span className="hidden lg:block">{scopeLabel(scope)}</span>
        )}
        <svg
          width="9" height="9" viewBox="0 0 9 9"
          className={`shrink-0 text-[var(--muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </button>

      {/* ── Panel ────────────────────────────────────────────────── */}
      <div
        className={`absolute right-0 w-[17rem] rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_12px_40px_oklch(0_0_0/0.12)] z-[var(--z-dropdown)] flex flex-col overflow-hidden
          transition-[opacity,transform,visibility] duration-150 ease-out
          ${placement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}
          ${open
            ? "opacity-100 translate-y-0 visible pointer-events-auto"
            : `opacity-0 ${placement === "top" ? "translate-y-2" : "-translate-y-2"} invisible pointer-events-none`
          }`}
      >
        {/* Presets */}
        <div className="p-2 flex items-center gap-1.5 border-b border-[var(--border)]">
          {PRESETS.map((preset) => {
            const active = scope === preset.key;
            return (
              <button
                key={preset.key}
                onClick={() => select(preset.key)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 font-semibold transition-colors ${
                  active
                    ? "bg-[var(--brand-primary)] text-white"
                    : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
                }`}
              >
                <span className="flex items-center justify-center h-7 w-full">{preset.icon}</span>
                <span className="text-[0.65rem] uppercase tracking-widest leading-none">{preset.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-2.5 py-2 border-b border-[var(--border)]">
          <div className="relative">
            <svg
              width="13" height="13" viewBox="0 0 16 16" fill="none"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 12l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Pretraži države..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--ink)] placeholder-[var(--subtle)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] hover:text-[var(--muted)] transition-colors"
                aria-label="Obriši pretragu"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Country list */}
        <div className="overflow-y-auto" style={{ maxHeight: "272px" }}>
          {filtered ? (
            /* Search results — flat */
            filtered.length === 0 ? (
              <p className="px-4 py-5 text-xs text-center text-[var(--subtle)]">
                Nema rezultata za „{search}"
              </p>
            ) : (
              <div>
                {filtered.map((country) => (
                  <CountryRow
                    key={country.noc}
                    country={country}
                    active={scope === country.noc}
                    available={AVAILABLE_COUNTRIES.has(country.noc)}
                    onSelect={() => select(country.noc)}
                  />
                ))}
              </div>
            )
          ) : (
            /* Grouped by continent */
            COUNTRY_GROUPS.map((group) => (
              <div key={group.continent}>
                <div className="sticky top-0 px-3 py-1 bg-[var(--surface)] border-b border-[var(--border)]">
                  <span className="text-[0.58rem] font-bold uppercase tracking-widest text-[var(--subtle)]">
                    {group.continent}
                  </span>
                </div>
                {group.countries.map((country) => (
                  <CountryRow
                    key={country.noc}
                    country={country}
                    active={scope === country.noc}
                    available={AVAILABLE_COUNTRIES.has(country.noc)}
                    onSelect={() => select(country.noc)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Country row ────────────────────────────────────────────────────────────────

function CountryRow({
  country,
  active,
  available,
  onSelect,
}: {
  country: Country;
  active: boolean;
  available: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={available ? onSelect : undefined}
      disabled={!available}
      title={available ? undefined : "Nema podataka za ovu zemlju"}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        !available
          ? "opacity-40 cursor-not-allowed"
          : active
          ? "bg-[var(--surface)] text-[var(--brand-primary)] hover:bg-[var(--surface-2)]"
          : "text-[var(--ink)] hover:bg-[var(--surface-2)]"
      }`}
    >
      <span className="text-base leading-none shrink-0" aria-hidden="true">
        {flagEmoji(country.alpha2)}
      </span>
      <span className="flex-1 text-xs font-medium leading-none">{country.name}</span>
      <span className="text-[0.62rem] font-bold font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] shrink-0">
        {country.noc}
      </span>
      {active && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--brand-primary)]" aria-hidden="true">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
