"use client";

import { useState, useRef, useEffect } from "react";
import type { CompetitionLevel } from "@/lib/pdf-import/types";
import { SearchDropdown } from "@/components/ui/SearchDropdown";

interface SyncEvent {
  key: string;
  source: "sss" | "issf" | "esc";
  name: string;
  dateFrom: string | null;
  dateTo: string | null;
  location: string | null;
  country: string | null;
  issfId: string | null;
  competitionTypeId: number | null;
  competitionTypeName: string | null;
  competitionTypeAcronym: string | null;
  detectedLevel: CompetitionLevel | null;
  alreadyInDb: boolean;
  currentTags: string[];
}

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "world",       label: "Svetsko" },
  { value: "continental", label: "Kontinentalno" },
  { value: "olympic",     label: "Olimpijsko" },
  { value: "national",    label: "Državno" },
  { value: "regional",    label: "Regionalno" },
  { value: "club",        label: "Klubsko" },
];

const LEVEL_COLORS: Record<CompetitionLevel, string> = {
  world:       "bg-blue-50 text-blue-700",
  continental: "bg-purple-50 text-purple-700",
  olympic:     "bg-yellow-50 text-yellow-700",
  national:    "bg-green-50 text-green-700",
  regional:    "bg-orange-50 text-orange-700",
  club:        "bg-gray-100 text-gray-600",
};

const SOURCE_COLORS: Record<string, string> = {
  issf: "bg-blue-50 text-blue-700",
  sss:  "bg-green-50 text-green-700",
  esc:  "bg-purple-50 text-purple-700",
};

function LevelPill({
  value,
  onChange,
  disabled,
}: {
  value: CompetitionLevel | null;
  onChange: (v: CompetitionLevel) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const label = value ? LEVELS.find((l) => l.value === value)?.label : "? izaberi";
  const pillCls = value
    ? `${LEVEL_COLORS[value]} cursor-pointer hover:opacity-80 transition-opacity`
    : "bg-amber-50 text-amber-700 cursor-pointer hover:opacity-80 transition-opacity";

  if (disabled) {
    return value ? (
      <span className={`text-[0.7rem] font-semibold px-2 py-0.5 rounded ${LEVEL_COLORS[value]}`}>{label}</span>
    ) : null;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`text-[0.7rem] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${pillCls}`}
      >
        {label}
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg py-1 min-w-[130px]">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(l.value); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface)] transition-colors"
            >
              <span className={`text-[0.7rem] font-semibold px-2 py-0.5 rounded ${LEVEL_COLORS[l.value]}`}>
                {l.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const ALL_SOURCES = ["issf", "sss", "esc"] as const;
type Source = typeof ALL_SOURCES[number];

const SOURCE_LABELS: Record<Source, string> = { issf: "ISSF", sss: "SSS", esc: "ESC" };

export function CompetitionsSyncClient() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [activeSources, setActiveSources] = useState<Set<Source>>(new Set(ALL_SOURCES));
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [levelOverrides, setLevelOverrides] = useState<Record<string, CompetitionLevel>>({});

  function toggleSource(s: Source) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
    setLoaded(false);
    setEvents([]);
  }

  async function loadEvents() {
    if (activeSources.size === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setLevelOverrides({});
    setLoaded(false);
    try {
      const sources = [...activeSources].join(",");
      const res = await fetch(`/api/admin/competitions/sync?year=${year}&sources=${sources}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setEvents(data);
      setLoaded(true);
      // Auto-select: new with level, AND already-in-db missing current source tag
      setSelected(new Set(
        data
          .filter((e: SyncEvent) =>
            e.detectedLevel !== null &&
            (!e.alreadyInDb || !e.currentTags.includes(e.source))
          )
          .map((e: SyncEvent) => e.key)
      ));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function getEffectiveLevel(e: SyncEvent): CompetitionLevel | null {
    return levelOverrides[e.key] ?? e.detectedLevel;
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function setOverride(key: string, level: CompetitionLevel) {
    setLevelOverrides((prev) => ({ ...prev, [key]: level }));
    setSelected((prev) => new Set([...prev, key]));
  }

  // Rows that need action: new ones, OR in DB but missing current source tag
  const needsAction = events.filter((e) =>
    !e.alreadyInDb || !e.currentTags.includes(e.source)
  );
  const allSelectableKeys = needsAction.filter((e) => getEffectiveLevel(e) !== null).map((e) => e.key);
  const allSelected = allSelectableKeys.length > 0 && allSelectableKeys.every((k) => selected.has(k));
  const unknownCount = needsAction.filter((e) => e.detectedLevel === null).length;
  const tagAddCount = events.filter((e) => e.alreadyInDb && !e.currentTags.includes(e.source)).length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allSelectableKeys));
  }

  async function handleCommit() {
    const toCommit = events
      .filter((e) => selected.has(e.key) && e.dateFrom)
      .map((e) => ({ ...e, level: getEffectiveLevel(e)! }));
    if (!toCommit.length) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/competitions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: toCommit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setResult(data);
      setEvents((prev) => prev.map((e) => selected.has(e.key) ? { ...e, alreadyInDb: true } : e));
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Sync takmičenja
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Uvezi takmičenja iz ISSF baze, SSS i ESC kalendara.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {result && (
        <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          <span style={{ color: "var(--success)" }} className="font-semibold">{result.inserted} uvezeno</span>
          {result.skipped > 0 && (
            <span className="text-[var(--muted)] ml-2">· {result.skipped} preskočeno (već postoje)</span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-[var(--border)] p-5 mb-5 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">Godina</label>
          <SearchDropdown
            value={String(year)}
            onChange={(v) => {
              if (!v) return;
              const y = parseInt(v);
              setYear(y);
              setLoaded(false);
              setEvents([]);
              if (y !== CURRENT_YEAR) {
                setActiveSources((prev) => { const next = new Set(prev); next.delete("sss"); return next; });
              } else {
                setActiveSources((prev) => new Set([...prev, "sss"]));
              }
            }}
            options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
            searchable={false}
            emptyLabel="— izaberi —"
            labelClassName="font-[family-name:var(--font-jetbrains-mono)] font-semibold"
            className="w-28"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">Izvor</label>
          <div className="flex gap-2">
            {ALL_SOURCES.map((s) => {
              const sssDisabled = s === "sss" && year !== CURRENT_YEAR;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => !sssDisabled && toggleSource(s)}
                  disabled={sssDisabled}
                  title={sssDisabled ? "SSS kalendar sadrži samo tekuću godinu" : undefined}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                    sssDisabled
                      ? "border-[var(--border)] text-[var(--subtle)] bg-[var(--bg)] opacity-40 cursor-not-allowed"
                      : activeSources.has(s)
                      ? "border-transparent " + SOURCE_COLORS[s]
                      : "border-[var(--border)] text-[var(--muted)] bg-[var(--bg)]"
                  }`}
                >
                  {SOURCE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={loadEvents}
          disabled={loading || activeSources.size === 0}
          className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
        >
          {loading ? "Učitavam..." : "Učitaj"}
        </button>
      </div>

      {loaded && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[var(--muted)] flex items-center gap-3 flex-wrap">
              <span><span className="font-semibold text-[var(--ink)]">{events.length}</span> takmičenja</span>
              {tagAddCount > 0 && (
                <span className="text-blue-600 text-xs font-medium">· {tagAddCount} čeka dodavanje taga</span>
              )}
              {unknownCount > 0 && (
                <span className="text-amber-600 text-xs font-medium">
                  · {unknownCount} bez nivoa — izaberi ručno
                </span>
              )}
            </div>
            {selected.size > 0 && (
              <button
                onClick={handleCommit}
                disabled={syncing}
                className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {syncing ? "Uvozim..." : `Uvezi ${selected.size} →`}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            {events.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--muted)]">Nema takmičenja za {year}.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={allSelectableKeys.length === 0}
                        className="accent-[var(--brand-primary)]"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Izvor</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Naziv</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Tip</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Nivo</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Datum</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Lokacija</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {events.map((e) => {
                    const effectiveLevel = getEffectiveLevel(e);
                    const hasSourceTag = e.currentTags.includes(e.source);
                    const fullyDone = e.alreadyInDb && hasSourceTag;
                    const canSelect = !fullyDone && effectiveLevel !== null;
                    return (
                      <tr
                        key={e.key}
                        className={`transition-colors ${fullyDone ? "opacity-35" : "hover:bg-[var(--surface)] cursor-pointer"}`}
                        onClick={() => canSelect && toggle(e.key)}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(e.key)}
                            disabled={!canSelect}
                            onChange={() => toggle(e.key)}
                            onClick={(ev) => ev.stopPropagation()}
                            className="accent-[var(--brand-primary)]"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[0.7rem] font-semibold px-2 py-0.5 rounded font-[family-name:var(--font-jetbrains-mono)] ${SOURCE_COLORS[e.source]}`}>
                            {SOURCE_LABELS[e.source]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[var(--ink)] max-w-[220px]">
                          <span className="line-clamp-2">{e.name}</span>
                        </td>
                        <td className="px-3 py-2.5 min-w-[140px]">
                          {e.competitionTypeName ? (
                            <span className="text-xs text-[var(--ink)]">
                              {e.competitionTypeName}{" "}
                              <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[0.7rem] text-[var(--muted)]">
                                ({e.competitionTypeAcronym})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--subtle)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <LevelPill
                            value={effectiveLevel}
                            onChange={(v) => setOverride(e.key, v)}
                            disabled={e.alreadyInDb}
                          />
                        </td>
                        <td className="px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] whitespace-nowrap">
                          {e.dateFrom}
                          {e.dateTo && e.dateTo !== e.dateFrom ? ` – ${e.dateTo}` : ""}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--muted)] text-xs">
                          {e.location ?? ""}
                          {e.country && e.country !== "SRB" ? `, ${e.country}` : ""}
                        </td>
                        <td className="px-3 py-2.5">
                          {e.alreadyInDb ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap gap-1">
                                {e.currentTags.map((t) => (
                                  <span key={t} className={`text-[0.65rem] font-semibold px-1.5 py-0.5 rounded font-[family-name:var(--font-jetbrains-mono)] ${SOURCE_COLORS[t] ?? "bg-gray-100 text-gray-600"}`}>
                                    {t.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                              {!hasSourceTag && (
                                <span className="text-[0.65rem] text-blue-600 font-medium">+ {e.source.toUpperCase()} tag</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[0.7rem] text-[var(--subtle)]">Novi</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
