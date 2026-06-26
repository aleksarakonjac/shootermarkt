"use client";

import { useState } from "react";

interface CalendarEvent {
  source: "sss" | "issf" | "esc";
  name: string;
  dateFrom: string | null;
  dateTo: string | null;
  location: string | null;
  country: string | null;
  is10m: boolean;
  url: string | null;
  externalId: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  sss: "SSS",
  issf: "ISSF",
  esc: "ESC",
};

const SOURCE_COLORS: Record<string, string> = {
  sss: "oklch(0.55 0.18 150)",  // green
  issf: "oklch(0.55 0.18 250)", // blue
  esc: "oklch(0.55 0.18 30)",   // orange
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1];

export function KalendarClient() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter10m, setFilter10m] = useState(true);
  const [sources, setSources] = useState<Set<string>>(new Set(["sss", "issf", "esc"]));
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/kalendar?year=${year}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setEvents(data);
      setLoaded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleSource(s: string) {
    setSources((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  const visible = events.filter((e) => {
    if (filter10m && !e.is10m) return false;
    if (!sources.has(e.source)) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by month
  const byMonth = visible.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = e.dateFrom ? e.dateFrom.slice(0, 7) : "unknown";
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  const months = Object.keys(byMonth).sort();

  const MONTH_NAMES: Record<string, string> = {
    "01": "Januar", "02": "Februar", "03": "Mart", "04": "April",
    "05": "Maj", "06": "Jun", "07": "Jul", "08": "Avgust",
    "09": "Septembar", "10": "Oktobar", "11": "Novembar", "12": "Decembar",
  };

  // Source counts
  const counts = { sss: 0, issf: 0, esc: 0 };
  events.filter((e) => e.is10m).forEach((e) => counts[e.source]++);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Kalendar takmičenja
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Agregacija SSS + ISSF + ESC kalendara
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-[var(--border)] p-4 mb-5 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => { setYear(y); setLoaded(false); setEvents([]); }}
              className="rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{
                background: year === y ? "var(--brand-primary)" : "var(--surface)",
                color: year === y ? "white" : "var(--ink)",
                border: "1px solid var(--border)",
              }}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {(["sss", "issf", "esc"] as const).map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: sources.has(s) ? SOURCE_COLORS[s] : "var(--surface)",
                color: sources.has(s) ? "white" : "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              {SOURCE_LABELS[s]}{loaded ? ` (${counts[s]})` : ""}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
          <input type="checkbox" checked={filter10m} onChange={(e) => setFilter10m(e.target.checked)} className="accent-[var(--brand-primary)]" />
          Samo 10m
        </label>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pretraži..."
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] w-48"
        />

        <button
          onClick={load}
          disabled={loading}
          className="ml-auto rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
        >
          {loading ? "Učitavam..." : loaded ? "Osveži" : "Učitaj"}
        </button>
      </div>

      {/* Source legend */}
      {loaded && (
        <div className="mb-4 flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">{visible.length} takmičenja</span>
          {(["sss", "issf", "esc"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: SOURCE_COLORS[s] }} />
              {SOURCE_LABELS[s]}
            </span>
          ))}
        </div>
      )}

      {/* Calendar by month */}
      {loaded && months.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] py-12 text-center text-sm text-[var(--muted)]">
          Nema takmičenja za odabrane filtere.
        </div>
      )}

      <div className="space-y-6">
        {months.map((monthKey) => {
          const [y, mo] = monthKey === "unknown" ? ["", ""] : monthKey.split("-");
          const monthLabel = mo ? `${MONTH_NAMES[mo] ?? mo} ${y}` : "Nepoznat datum";
          const monthEvents = byMonth[monthKey].sort((a, b) =>
            (a.dateFrom ?? "").localeCompare(b.dateFrom ?? "")
          );

          return (
            <div key={monthKey}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2 px-1">
                {monthLabel}
              </h2>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
                {monthEvents.map((e, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface)] transition-colors">
                    {/* Source dot */}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: SOURCE_COLORS[e.source] }}
                      title={SOURCE_LABELS[e.source]}
                    />
                    {/* Date */}
                    <div className="w-24 shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                      {e.dateFrom ? formatDate(e.dateFrom) : "—"}
                      {e.dateTo && e.dateTo !== e.dateFrom && (
                        <span className="block">{formatDate(e.dateTo)}</span>
                      )}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)] truncate">{e.name}</p>
                      {(e.location || e.country) && (
                        <p className="text-xs text-[var(--subtle)] mt-0.5">
                          {[e.location, e.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[0.65rem] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: "var(--surface)", color: SOURCE_COLORS[e.source], border: "1px solid var(--border)" }}
                      >
                        {SOURCE_LABELS[e.source]}
                      </span>
                      {e.is10m && (
                        <span className="text-[0.65rem] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)", border: "1px solid var(--border)" }}>
                          10m
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
