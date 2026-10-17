"use client";

import { useState, useRef, useEffect } from "react";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { formatDateRangeSr } from "@/lib/date-utils";
import { SyncRowEditor, type Country, type Draft, type SiusSuggestion } from "./sync-row-editor";

interface SyncEvent {
  key: string;
  source: "sss" | "issf" | "esc";
  name: string;
  dateFrom: string | null;
  dateTo: string | null;
  location: string | null;
  country: string | null;
  countryId: number | null;
  disciplineGroups: string[];
  issfId: string | null;
  siusSuggestion: SiusSuggestion | null;
  currentSiusId: string | null;
  competitionTypeId: number | null;
  competitionTypeName: string | null;
  competitionTypeAcronym: string | null;
  detectedLevel: CompetitionLevel | null;
  alreadyInDb: boolean;
  currentTags: string[];
  conflictGroupId: string | null;
  conflictPriority: number;
}

const LEVEL_COLORS: Record<string, string> = {
  world:         "bg-blue-50 text-blue-700",
  continental:   "bg-purple-50 text-purple-700",
  international: "bg-sky-50 text-sky-700",
  olympic:       "bg-yellow-50 text-yellow-700",
  national:      "bg-green-50 text-green-700",
  regional:      "bg-orange-50 text-orange-700",
  club:          "bg-gray-100 text-gray-600",
};

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "world",         label: "ISSF–Svetsko" },
  { value: "continental",   label: "Kontinentalno" },
  { value: "international", label: "Međunarodno" },
  { value: "olympic",       label: "Olimpijsko" },
  { value: "national",      label: "Državno" },
  { value: "regional",      label: "Regionalno" },
  { value: "club",          label: "Klubsko" },
];

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

function toDraft(e: SyncEvent): Draft {
  return {
    name: e.name,
    nameSr: "",
    nameEn: "",
    dateFrom: e.dateFrom ?? "",
    dateTo: e.dateTo ?? "",
    location: e.location ?? "",
    locationSr: "",
    locationEn: "",
    countryId: e.countryId == null ? "" : String(e.countryId),
    level: e.detectedLevel ?? "",
    eventType: "other",
    ageCategory: "open",
    focusPriority: "",
    organizer: e.source.toUpperCase(),
    issfId: e.issfId ?? "",
    siusId: e.siusSuggestion?.confident ? e.siusSuggestion.id : "",
    disciplineGroups: e.disciplineGroups,
    tags: [],
  };
}

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true" className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}>
      <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Existing competition that has no SIUS UUID yet but got a confident one from the lookup. */
const gainsSius = (e: SyncEvent) => e.alreadyInDb && !e.currentSiusId && !!e.siusSuggestion?.confident;

function RowStatus({ e, hasSourceTag }: { e: SyncEvent; hasSourceTag: boolean }) {
  if (!e.alreadyInDb) return <span className="text-[0.7rem] text-[var(--subtle)]">Novi</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {e.currentTags.map((t) => (
        <span key={t} className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold font-[family-name:var(--font-jetbrains-mono)] ${SOURCE_COLORS[t] ?? "bg-gray-100 text-gray-600"}`}>{t.toUpperCase()}</span>
      ))}
      {!hasSourceTag && <span className="text-[0.65rem] font-medium text-blue-700">+ {e.source.toUpperCase()} tag</span>}
      {gainsSius(e) && <span className="text-[0.65rem] font-medium text-green-700">+ SIUS UUID</span>}
    </div>
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const ALL_SOURCES = ["issf", "sss", "esc"] as const;
type Source = typeof ALL_SOURCES[number];

const SOURCE_LABELS: Record<Source, string> = { issf: "ISSF", sss: "SSS", esc: "ESC" };

export function CompetitionsSyncClient({ countries }: { countries: Country[] }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [activeSources, setActiveSources] = useState<Set<Source>>(new Set(ALL_SOURCES));
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [baseline, setBaseline] = useState<Record<string, Draft>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggleSource(s: Source) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) { next.delete(s); } else { next.add(s); }
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
    setDrafts({});
    setBaseline({});
    setOpen(new Set());
    setLoaded(false);
    try {
      const sources = [...activeSources].join(",");
      const res = await fetch(`/api/admin/competitions/sync?year=${year}&sources=${sources}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      const initial = Object.fromEntries((data as SyncEvent[]).map((e) => [e.key, toDraft(e)]));
      setEvents(data);
      setDrafts(initial);
      setBaseline(initial);
      setLoaded(true);

      // Per conflict group: keep only highest-priority source selected
      const groupBest = new Map<string, { priority: number; key: string }>();
      for (const e of data as SyncEvent[]) {
        if (!e.conflictGroupId) continue;
        const cur = groupBest.get(e.conflictGroupId);
        if (!cur || e.conflictPriority < cur.priority) {
          groupBest.set(e.conflictGroupId, { priority: e.conflictPriority, key: e.key });
        }
      }
      const conflictLoserKeys = new Set(
        (data as SyncEvent[])
          .filter((e) => e.conflictGroupId && groupBest.get(e.conflictGroupId)?.key !== e.key)
          .map((e) => e.key)
      );

      // Auto-select: new with level, missing source tag, not a conflict loser
      setSelected(new Set(
        (data as SyncEvent[])
          .filter((e) =>
            e.detectedLevel !== null &&
            (!e.alreadyInDb || !e.currentTags.includes(e.source) || gainsSius(e)) &&
            !conflictLoserKeys.has(e.key)
          )
          .map((e) => e.key)
      ));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function getEffectiveLevel(e: SyncEvent): CompetitionLevel | null {
    return (drafts[e.key]?.level || null) as CompetitionLevel | null;
  }

  function isComplete(e: SyncEvent) {
    const d = drafts[e.key];
    return !!d && d.name.trim() !== "" && d.dateFrom !== "" && d.level !== "";
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  function toggleOpen(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  function patchDraft(key: string, patch: Partial<Draft>) {
    const next = { ...drafts[key], ...patch };
    setDrafts((prev) => ({ ...prev, [key]: next }));
    // Editing a row opts it in to the import once it has name, start date and level.
    if (next.name.trim() && next.dateFrom && next.level) setSelected((prev) => new Set([...prev, key]));
    else setSelected((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }

  function resetDraft(e: SyncEvent) {
    setDrafts((prev) => ({ ...prev, [e.key]: baseline[e.key] }));
  }

  // Rows that need action: new ones, OR in DB but missing current source tag
  const needsAction = events.filter((e) =>
    !e.alreadyInDb || !e.currentTags.includes(e.source)
  );
  const allSelectableKeys = needsAction.filter(isComplete).map((e) => e.key);
  const allSelected = allSelectableKeys.length > 0 && allSelectableKeys.every((k) => selected.has(k));
  const unknownCount = needsAction.filter((e) => !drafts[e.key]?.level).length;
  const editedCount = events.filter((e) => drafts[e.key] && baseline[e.key] && !sameDraft(drafts[e.key], baseline[e.key])).length;
  const tagAddCount = events.filter((e) => e.alreadyInDb && !e.currentTags.includes(e.source)).length;
  const conflictGroupIds = new Set(events.map((e) => e.conflictGroupId).filter(Boolean));
  const conflictCount = conflictGroupIds.size;

  // Sort: conflict groups first (grouped), then rest in original order
  const displayEvents = (() => {
    const conflictFirst: typeof events = [];
    const rest: typeof events = [];
    const groupOrder = new Map<string, number>();
    for (const e of events) {
      if (e.conflictGroupId && !groupOrder.has(e.conflictGroupId)) {
        groupOrder.set(e.conflictGroupId, groupOrder.size);
      }
    }
    const conflictMap = new Map<string, typeof events>();
    for (const e of events) {
      if (e.conflictGroupId) {
        const g = conflictMap.get(e.conflictGroupId) ?? [];
        g.push(e);
        conflictMap.set(e.conflictGroupId, g);
      } else {
        rest.push(e);
      }
    }
    const sortedGroups = [...conflictMap.entries()].sort(
      ([a], [b]) => (groupOrder.get(a) ?? 0) - (groupOrder.get(b) ?? 0)
    );
    for (const [, group] of sortedGroups) {
      group.sort((a, b) => a.conflictPriority - b.conflictPriority);
      conflictFirst.push(...group);
    }
    return [...conflictFirst, ...rest];
  })();

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allSelectableKeys));
  }

  async function handleCommit() {
    const toCommit = events
      .filter((e) => selected.has(e.key) && isComplete(e))
      .map((e) => {
        const d = drafts[e.key];
        return {
          key: e.key,
          source: e.source,
          name: d.name,
          nameSr: d.nameSr,
          nameEn: d.nameEn,
          dateFrom: d.dateFrom,
          dateTo: d.dateTo || null,
          location: d.location,
          locationSr: d.locationSr,
          locationEn: d.locationEn,
          countryId: d.countryId ? Number(d.countryId) : null,
          level: d.level as CompetitionLevel,
          eventType: d.eventType,
          ageCategory: d.ageCategory,
          focusPriority: d.focusPriority === "" ? null : Number(d.focusPriority),
          organizer: d.organizer,
          issfId: d.issfId.trim() || null,
          siusId: d.siusId.trim() || null,
          disciplineGroups: d.disciplineGroups,
          tags: d.tags,
        };
      });
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
    <div className="max-w-6xl">
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
              {editedCount > 0 && (
                <span className="text-xs font-medium text-[var(--brand-primary)]">· {editedCount} izmenjeno</span>
              )}
              {conflictCount > 0 && (
                <span className="text-orange-600 text-xs font-medium">
                  · {conflictCount} potencijalnih duplikata — proveri
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

          <div className="rounded-xl border border-[var(--border)]">
            {events.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--muted)]">Nema takmičenja za {year}.</div>
            ) : (
              <>
                <div className="hidden items-center gap-3 rounded-t-xl border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] md:grid md:grid-cols-[2.25rem_3.5rem_minmax(0,1fr)_9rem_13rem_10rem_6rem]">
                  <input
                    type="checkbox"
                    aria-label="Izaberi sva"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={allSelectableKeys.length === 0}
                    className="accent-[var(--brand-primary)]"
                  />
                  <span>Izvor</span>
                  <span>Naziv</span>
                  <span>Nivo</span>
                  <span>Datum</span>
                  <span>Lokacija</span>
                  <span>Status</span>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {displayEvents.map((e, idx) => {
                    const d = drafts[e.key];
                    if (!d) return null;
                    const hasSourceTag = e.currentTags.includes(e.source);
                    const fullyDone = e.alreadyInDb && hasSourceTag && !gainsSius(e);
                    const complete = isComplete(e);
                    const canSelect = !fullyDone && complete;
                    const isConflict = !!e.conflictGroupId;
                    const isOpen = open.has(e.key);
                    const edited = !sameDraft(d, baseline[e.key]);
                    const panelId = `sync-row-${idx}`;
                    const countryName = countries.find((c) => String(c.id) === d.countryId)?.name ?? e.country;
                    return (
                      <li key={e.key} className={`${isConflict && !fullyDone ? "bg-orange-50/40" : ""} ${isOpen ? "bg-[var(--surface)]" : ""}`}>
                        <div className={`grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0 px-3 py-1 md:grid-cols-[2.25rem_3.5rem_minmax(0,1fr)_9rem_13rem_10rem_6rem] ${fullyDone ? "opacity-40" : ""}`}>
                          <input
                            type="checkbox"
                            aria-label={`Izaberi: ${d.name}`}
                            checked={selected.has(e.key)}
                            disabled={!canSelect}
                            onChange={() => toggle(e.key)}
                            className="accent-[var(--brand-primary)] md:col-start-1"
                          />
                          <span className={`hidden w-fit rounded px-2 py-0.5 text-[0.7rem] font-semibold md:col-start-2 md:row-start-1 md:inline-block font-[family-name:var(--font-jetbrains-mono)] ${SOURCE_COLORS[e.source]}`}>{SOURCE_LABELS[e.source]}</span>
                          <button
                            type="button"
                            onClick={() => toggleOpen(e.key)}
                            disabled={e.alreadyInDb}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            className="col-start-2 row-start-1 flex min-h-11 min-w-0 items-center gap-2 py-1 text-left disabled:cursor-default md:col-start-3"
                          >
                            <span className="shrink-0 text-[var(--muted)]">{!e.alreadyInDb && <Chevron open={isOpen} />}</span>
                            <span className="min-w-0">
                              <span className="line-clamp-2 text-sm font-medium text-[var(--ink)]">{d.name || "(bez naziva)"}</span>
                              <span className="flex flex-wrap items-center gap-x-2 text-[0.7rem] font-medium">
                                {e.competitionTypeName && <span className="text-[var(--muted)]">{e.competitionTypeName}{e.competitionTypeAcronym ? ` (${e.competitionTypeAcronym})` : ""}</span>}
                                {isConflict && !fullyDone && <span className="text-orange-700">moguć duplikat</span>}
                                {d.siusId && <span className="text-green-700">SIUS povezan</span>}
                                {edited && <span className="text-[var(--brand-primary)]">izmenjeno</span>}
                                {!complete && !fullyDone && <span className="text-amber-700">nepotpuno</span>}
                              </span>
                            </span>
                          </button>
                          <div className="col-start-3 row-start-1 md:col-start-4">
                            <LevelPill value={getEffectiveLevel(e)} onChange={(v) => patchDraft(e.key, { level: v })} disabled={e.alreadyInDb} />
                          </div>
                          <span className="hidden font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] md:col-start-5 md:row-start-1 md:block">{formatDateRangeSr(d.dateFrom || null, d.dateTo || null)}</span>
                          <span className="hidden text-xs text-[var(--muted)] md:col-start-6 md:row-start-1 md:block">{[d.location, countryName && countryName !== "SRB" ? countryName : null].filter(Boolean).join(", ")}</span>
                          <div className="hidden md:col-start-7 md:row-start-1 md:block">
                            <RowStatus e={e} hasSourceTag={hasSourceTag} />
                          </div>
                          {/* Mobile meta line */}
                          <div className="col-start-2 col-span-2 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 pl-5 text-xs text-[var(--muted)] md:hidden">
                            <span className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold font-[family-name:var(--font-jetbrains-mono)] ${SOURCE_COLORS[e.source]}`}>{SOURCE_LABELS[e.source]}</span>
                            <span className="font-[family-name:var(--font-jetbrains-mono)]">{formatDateRangeSr(d.dateFrom || null, d.dateTo || null)}</span>
                            <span>{[d.location, countryName && countryName !== "SRB" ? countryName : null].filter(Boolean).join(", ")}</span>
                            <RowStatus e={e} hasSourceTag={hasSourceTag} />
                          </div>
                        </div>
                        {isOpen && !e.alreadyInDb && (
                          <SyncRowEditor
                            id={panelId}
                            draft={d}
                            source={e.source}
                            countries={countries}
                            sourceCountry={e.country}
                            siusSuggestion={e.siusSuggestion}
                            edited={edited}
                            onChange={(patch) => patchDraft(e.key, patch)}
                            onReset={() => resetDraft(e)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
