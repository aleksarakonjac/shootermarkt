"use client";

import { useState, useTransition, useId } from "react";
import type { ISSFScheduleEntry } from "@shootermarkt/adapters/issf/adapter";
import { SearchDropdown } from "@/components/ui/SearchDropdown";

interface CompOption { id: number; name: string; date: string; dateEnd: string | null; location: string | null; nocCode: string | null; }
interface FeaturedComp extends CompOption { status: "current" | "upcoming" | "past"; }
interface DiscOption  { id: number; code: string; name: string; }

interface Props {
  competitions: CompOption[];
  featured: FeaturedComp[];
  disciplines:  DiscOption[];
}

const FEATURED_LABEL: Record<FeaturedComp["status"], string> = {
  current:  "🔴 Tekuće",
  upcoming: "🔜 Uskoro",
  past:     "✅ Skoro završeno",
};

const STAGE_LABEL: Record<string, string> = {
  qual:        "Kval",
  elimination: "Elim",
  final:       "Final",
  training:    "Trening",
  ceremony:    "Medalje",
  other:       "Ostalo",
};

const STAGE_COLOR: Record<string, string> = {
  qual:        "bg-blue-100 text-blue-700",
  elimination: "bg-orange-100 text-orange-700",
  final:       "bg-emerald-100 text-emerald-700",
  training:    "bg-gray-100 text-gray-500",
  ceremony:    "bg-yellow-100 text-yellow-700",
  other:       "bg-gray-100 text-gray-500",
};

function extractIssfId(input: string): number | null {
  // Accept plain number or URL like .../competitions/3574/schedule
  const numMatch = input.match(/\d{3,6}/);
  return numMatch ? parseInt(numMatch[0]) : null;
}

export function ISSFScheduleImportClient({ competitions, featured, disciplines }: Props) {
  const uid = useId();
  const [issfInput,  setIssfInput]  = useState("");
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [dbCompId,   setDbCompId]   = useState<number | "">("");
  const [entries,    setEntries]    = useState<ISSFScheduleEntry[] | null>(null);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [showAll,    setShowAll]    = useState(false);
  const [fetchErr,   setFetchErr]   = useState<string | null>(null);
  const [importMsg,  setImportMsg]  = useState<string | null>(null);
  const [importing,  startImport]   = useTransition();
  const [fetching,   startFetch]    = useTransition();

  function toggleAll() {
    if (selected.size === displayEntries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayEntries.map((e) => e._idx)));
    }
  }

  function toggleOne(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function handleFetch() {
    setFetchErr(null);
    setImportMsg(null);
    const issfId = extractIssfId(issfInput);
    if (!issfId) { setFetchErr("Unesi ISSF ID ili URL takmičenja."); return; }
    startFetch(async () => {
      const res = await fetch(`/api/admin/issf/schedule?issfId=${issfId}&year=${year}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setFetchErr(err.error ?? "Greška pri preuzimanju.");
        return;
      }
      const data: ISSFScheduleEntry[] = await res.json();
      setEntries(data);
      // Auto-select all discipline-mapped entries by their index in the full array
      const autoSelected = new Set(
        data.reduce<number[]>((acc, e, i) => { if (e.disciplineCode) acc.push(i); return acc; }, [])
      );
      setSelected(autoSelected);
    });
  }

  function handleImport() {
    if (!dbCompId) { setImportMsg("Izaberi takmičenje iz baze."); return; }
    const toImport = entries!.filter((_, i) => selected.has(i));
    if (!toImport.length) { setImportMsg("Nijedan unos nije izabran."); return; }
    setImportMsg(null);
    startImport(async () => {
      const res = await fetch("/api/admin/issf/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbCompetitionId: dbCompId, entries: toImport }),
      });
      const data = await res.json();
      if (!res.ok) { setImportMsg(`Greška: ${data.error}`); return; }
      setImportMsg(`Importovano ${data.imported}, preskočeno (duplikat) ${data.skipped}.`);
      setSelected(new Set());
    });
  }

  // For the table, we need indexes relative to `entries` for selection tracking
  // Let's simplify: entries have stable indexes from the fetched array
  const displayEntries = entries
    ? entries.map((e, i) => ({ ...e, _idx: i })).filter((e) => showAll || e.disciplineCode)
    : [];

  return (
    <div className="space-y-6">
      {/* ── Inputs ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--ink)]">1. Konfiguracija</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${uid}-issf`} className="block text-xs font-medium text-[var(--muted)] mb-1">
              ISSF takmičenje (ID ili URL)
            </label>
            <input
              id={`${uid}-issf`}
              type="text"
              value={issfInput}
              onChange={(e) => setIssfInput(e.target.value)}
              placeholder="3574 ili https://www.issf-sports.org/competitions/3574/schedule"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label htmlFor={`${uid}-year`} className="block text-xs font-medium text-[var(--muted)] mb-1">
              Godina takmičenja
            </label>
            <input
              id={`${uid}-year`}
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || year)}
              min={2020}
              max={2030}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
            Izdvojena takmičenja
          </label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {featured.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setDbCompId(c.id)}
                className={`text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                  dbCompId === c.id
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                    : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/70"
                }`}
              >
                <span className="text-[var(--muted)] mr-1.5">{FEATURED_LABEL[c.status]}</span>
                <span className="text-[var(--ink)] font-medium">{c.name}</span>
                <span className="text-[var(--subtle)] ml-1.5">
                  {c.date}{c.location ? ` · ${c.location}` : ""}
                </span>
              </button>
            ))}
            {featured.length === 0 && (
              <p className="text-xs text-[var(--subtle)]">Nema tekućih, uskoro ili nedavno završenih takmičenja.</p>
            )}
          </div>

          <label htmlFor={`${uid}-comp`} className="block text-xs font-medium text-[var(--muted)] mb-1">
            Takmičenje u bazi (za koje se importuje satnica)
          </label>
          <SearchDropdown
            id={`${uid}-comp`}
            value={String(dbCompId)}
            onChange={(value) => setDbCompId(value ? parseInt(value) : "")}
            options={competitions.map((competition) => ({
              value: String(competition.id),
              label: competition.name,
              sublabel: [
                competition.dateEnd ? `${competition.date} – ${competition.dateEnd}` : competition.date,
                competition.location,
              ].filter(Boolean).join(" · "),
            }))}
            placeholder="— Izaberi takmičenje —"
            emptyLabel="— Izaberi takmičenje —"
            searchPlaceholder="Pretraži takmičenja..."
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleFetch}
            disabled={fetching || !issfInput}
            className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {fetching ? "Preuzimanje…" : "Preuzmi satnicu"}
          </button>
          {fetchErr && <p className="text-sm text-red-500">{fetchErr}</p>}
        </div>
      </div>

      {/* ── Preview Table ── */}
      {entries !== null && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink)]">2. Pregled i izbor</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {entries.filter((e) => e.disciplineCode).length} od {entries.length} unosa se može mapirati u disciplinu
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded"
              />
              Prikaži sve unose (uključujući trening, ceremonije…)
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === displayEntries.length && displayEntries.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Datum</th>
                  <th className="p-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Vreme</th>
                  <th className="p-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Događaj</th>
                  <th className="p-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Disciplina</th>
                  <th className="p-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Faza</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry) => {
                  const checked = selected.has(entry._idx);
                  return (
                    <tr
                      key={entry._idx}
                      onClick={() => toggleOne(entry._idx)}
                      className={`border-b border-[var(--border)] cursor-pointer transition-colors last:border-0 ${
                        checked ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]/50"
                      } ${!entry.disciplineCode ? "opacity-40" : ""}`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(entry._idx)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!entry.disciplineCode}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 text-[var(--muted)] whitespace-nowrap text-xs">
                        {entry.date}
                      </td>
                      <td className="p-3 text-[var(--ink)] whitespace-nowrap font-mono text-xs">
                        {entry.startTime || "—"}
                        {entry.endTime && <span className="text-[var(--muted)]"> – {entry.endTime}</span>}
                      </td>
                      <td className="p-3 text-[var(--ink)] max-w-xs">
                        <span className="line-clamp-1">{entry.eventTitle}</span>
                        {entry.relay !== null && (
                          <span className="ml-1 text-[var(--muted)] text-xs">· Relay {entry.relay}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {entry.disciplineCode ? (
                          <span className="font-mono text-xs font-bold text-[var(--brand-primary)]">
                            {entry.disciplineCode}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--subtle)]">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLOR[entry.stage] ?? ""}`}>
                          {STAGE_LABEL[entry.stage] ?? entry.stage}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {displayEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[var(--muted)] text-sm">
                      Nema unosa za prikaz.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Import ── */}
          <div className="flex items-center gap-4 pt-1 flex-wrap">
            <button
              onClick={handleImport}
              disabled={importing || selected.size === 0 || !dbCompId}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {importing ? "Importovanje…" : `Importuj ${selected.size} unosa`}
            </button>
            {!dbCompId && (
              <p className="text-xs text-[var(--muted)]">Izaberi takmičenje u bazi pre importa.</p>
            )}
            {importMsg && (
              <p className={`text-sm ${importMsg.startsWith("Greška") ? "text-red-500" : "text-emerald-600"}`}>
                {importMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
