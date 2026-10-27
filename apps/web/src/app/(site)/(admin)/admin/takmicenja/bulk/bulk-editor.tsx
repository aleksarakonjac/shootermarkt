"use client";

import type { Country as DropdownCountry } from "@/components/ui/CountryDropdown";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { LEVEL_LABEL } from "@/lib/competition-utils";
import { formatDateRangeSr } from "@/lib/date-utils";
import type { CompetitionMatch } from "@/app/api/admin/competitions/[id]/matches/route";
import { EVENT_TYPES } from "../sync/sync-row-editor";
import { CompetitionModal, matchKey } from "./competition-modal";

export type Country = DropdownCountry;
export type BulkRow = {
  id: number;
  name: string;
  nameSr: string | null;
  nameEn: string | null;
  date: string;
  dateEnd: string | null;
  location: string | null;
  locationSr: string | null;
  locationEn: string | null;
  countryId: number | null;
  level: string;
  eventType: string;
  ageCategory: string;
  focusPriority: number | null;
  organizer: string | null;
  issfId: string | null;
  siusId: string | null;
  sourcePdfUrl: string | null;
  tags: string[];
  disciplineGroups: string[];
  timezone: string;
  /** Podrazumevani prioritet kad je override prazan */
  autoPriority: number;
  matchCount: number;
  resultCount: number;
};
export type Editable = Omit<BulkRow, "id" | "autoPriority" | "matchCount" | "resultCount">;
export type MatchDraft = { competitionId: number; disciplineId: number; eventId: number | null; from: string; to: string };

const EVENT_TYPE_LABEL = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label]));
const GROUP_LABEL: Record<string, string> = { air: "10m", smallbore: "MK" };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function BulkEditor({ rows, year, years, countries }: { rows: BulkRow[]; year: number; years: number[]; countries: Country[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, Partial<Editable>>>({});
  const [matchDrafts, setMatchDrafts] = useState<Record<string, MatchDraft>>({});
  const [matchCache, setMatchCache] = useState<Record<number, CompetitionMatch[]>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; competitionId?: number } | null>(null);

  const countryBy = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const changedIds = new Set([...Object.keys(drafts).map(Number), ...Object.values(matchDrafts).map((m) => m.competitionId)]);
  const dirty = changedIds.size;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const current = (r: BulkRow): BulkRow => ({ ...r, ...drafts[r.id] });

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => {
        const c = current(r);
        return [c.name, c.nameSr, c.nameEn, c.location, c.locationSr, c.locationEn].some((v) => v?.toLowerCase().includes(q));
      })
    : rows;

  function changeYear(y: string) {
    if (dirty && !window.confirm(`Imaš ${dirty} nesačuvanih izmena. Promena godine ih odbacuje. Nastavi?`)) return;
    setDrafts({});
    setMatchDrafts({});
    router.push(`?year=${y}`);
  }

  function confirmEdit(row: BulkRow, values: Editable, targets: Record<string, string>) {
    const patch: Partial<Editable> = {};
    for (const k of Object.keys(values) as (keyof Editable)[]) {
      if (!same(values[k], row[k])) (patch as Record<string, unknown>)[k] = values[k];
    }
    setDrafts((prev) => {
      const next = { ...prev };
      if (Object.keys(patch).length) next[row.id] = patch;
      else delete next[row.id];
      return next;
    });
    setMatchDrafts((prev) => {
      const next = { ...prev };
      for (const m of matchCache[row.id] ?? []) {
        const key = matchKey(row.id, m);
        const to = targets[key];
        if (to && to !== m.category) next[key] = { competitionId: row.id, disciplineId: m.disciplineId, eventId: m.eventId, from: m.category, to };
        else delete next[key];
      }
      return next;
    });
    setEditing(null);
  }

  function revert(id: number) {
    setDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setMatchDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([, m]) => m.competitionId !== id)));
    setEditing(null);
  }

  function discardAll() {
    if (!window.confirm(`Odbaci svih ${dirty} nesačuvanih izmena?`)) return;
    setDrafts({});
    setMatchDrafts({});
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/competitions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitions: Object.entries(drafts).map(([id, patch]) => ({ id: Number(id), ...patch })),
          matches: Object.values(matchDrafts),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const row = rows.find((r) => r.id === json.competitionId);
        setMessage({ ok: false, text: `${row ? `${current(row).nameSr ?? row.name}: ` : ""}${json.error ?? `Greška ${res.status}`}`, competitionId: json.competitionId });
        return;
      }
      setDrafts({});
      setMatchDrafts({});
      setMatchCache({});
      setMessage({ ok: true, text: `Sačuvano u bazu: ${dirty} ${dirty === 1 ? "takmičenje" : "takmičenja"}.` });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Veza sa serverom nije uspela — ništa nije sačuvano. Pokušaj ponovo." });
    } finally {
      setSaving(false);
    }
  }

  const onMatchesLoaded = useCallback((id: number, matches: CompetitionMatch[]) => setMatchCache((prev) => ({ ...prev, [id]: matches })), []);
  const closeModal = useCallback(() => setEditing(null), []);
  const editingRow = editing == null ? null : rows.find((r) => r.id === editing) ?? null;

  const saveButtons = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={discardAll}
        disabled={!dirty || saving}
        className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-40"
      >
        Poništi sve
      </button>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white tabular-nums hover:bg-[var(--brand-primary-hover)] disabled:opacity-40"
      >
        {saving ? "Čuvam…" : `Sačuvaj u bazu${dirty ? ` (${dirty})` : ""}`}
      </button>
    </div>
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="bulk-year">Godina</label>
        <select
          id="bulk-year"
          value={year}
          onChange={(e) => changeYear(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-[var(--ink)] tabular-nums"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Traži naziv ili lokaciju…"
          aria-label="Traži takmičenje"
          className="w-64 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
        <span className="text-sm text-[var(--muted)] tabular-nums">
          {visible.length === rows.length ? `${rows.length} takmičenja` : `${visible.length} od ${rows.length}`}
        </span>
        <div className="ml-auto">{saveButtons}</div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] py-16 text-center text-sm text-[var(--muted)]">Nema takmičenja u kalendaru za {year}.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[1150px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                <th scope="col" className="px-3 py-2.5">Takmičenje</th>
                <th scope="col" className="w-32 px-3 py-2.5">Datum</th>
                <th scope="col" className="w-44 px-3 py-2.5">Lokacija</th>
                <th scope="col" className="w-32 px-3 py-2.5">Nivo · tip</th>
                <th scope="col" className="w-20 px-3 py-2.5">Prioritet</th>
                <th scope="col" className="w-20 px-3 py-2.5">ISSF</th>
                <th scope="col" className="w-16 px-3 py-2.5">SIUS</th>
                <th scope="col" className="w-36 px-3 py-2.5">Discipline</th>
                <th scope="col" className="w-24 px-3 py-2.5"><span className="sr-only">Akcije</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((r) => {
                const c = current(r);
                const changed = changedIds.has(r.id);
                const failed = message?.ok === false && message.competitionId === r.id;
                const country = c.countryId == null ? null : countryBy.get(c.countryId);
                const pendingMatches = Object.values(matchDrafts).filter((m) => m.competitionId === r.id).length;
                return (
                  <tr
                    key={r.id}
                    className={`align-top ${changed ? "bg-[color-mix(in_srgb,var(--brand-primary)_6%,transparent)]" : ""} ${failed ? "outline outline-2 -outline-offset-2 outline-[var(--brand-primary)]" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-[var(--ink)]">{c.nameSr ?? c.name}</span>
                        {!c.nameSr && <span className="shrink-0 text-[0.7rem] italic text-[var(--subtle)]" title="Nema SR prevoda — javni sajt prikazuje originalni naziv">orig.</span>}
                        {changed && (
                          <span className="shrink-0 rounded bg-[var(--brand-primary)] px-1.5 py-px text-[0.65rem] font-bold uppercase tracking-wide text-white">
                            izmenjeno{pendingMatches > 0 && ` · ${pendingMatches} meč.`}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-2 text-xs text-[var(--muted)]">
                        <span>{c.nameEn ?? c.name}</span>
                        {!c.nameEn && <span className="shrink-0 text-[0.7rem] italic text-[var(--subtle)]" title="Nema EN prevoda — javni sajt prikazuje originalni naziv">orig.</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--ink)] tabular-nums">{formatDateRangeSr(c.date, c.dateEnd)}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-[var(--ink)]">{c.locationSr ?? c.location ?? <span className="text-[var(--subtle)]">—</span>}</div>
                      <div className="mt-0.5 text-xs text-[var(--muted)]" title={country?.name}>{country ? country.nocCode ?? country.name : "bez države"}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[var(--ink)]">{LEVEL_LABEL[c.level] ?? c.level}</div>
                      <div className="mt-0.5 text-xs text-[var(--muted)]">{EVENT_TYPE_LABEL[c.eventType] ?? c.eventType}</div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {c.focusPriority != null ? <span className="font-semibold text-[var(--ink)]">{c.focusPriority}</span> : <span className="text-[var(--muted)]">auto {r.autoPriority}</span>}
                    </td>
                    <td className="px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">
                      {c.issfId ? <span className="text-[var(--ink)]">{c.issfId}</span> : <span className="text-[var(--subtle)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.siusId ? <span className="font-semibold text-[var(--ink)]" title={c.siusId}>ima</span> : <span className="text-[var(--subtle)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.disciplineGroups.length === 0
                          ? <span className="text-xs text-[var(--subtle)]">nije uneto</span>
                          : c.disciplineGroups.map((g) => (
                              <span key={g} className="rounded border border-[var(--border)] px-1.5 text-[0.7rem] font-semibold text-[var(--ink)]">{GROUP_LABEL[g] ?? g}</span>
                            ))}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--muted)] tabular-nums">
                        {r.resultCount ? `${r.matchCount} meč. · ${r.resultCount} rez.` : "bez rezultata"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(r.id)}
                        aria-label={`Izmeni: ${c.nameSr ?? c.name}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                      >
                        <Pencil size={13} aria-hidden />
                        Izmeni
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-sm text-[var(--muted)]">Nijedno takmičenje iz {year}. ne odgovara pretrazi „{query}“.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]">
        <span className="text-sm text-[var(--muted)] tabular-nums">
          {dirty ? `Nesačuvano: ${dirty} ${dirty === 1 ? "takmičenje" : "takmičenja"}` : "Nema izmena"}
        </span>
        {message && (
          <span role="status" className="text-sm font-medium" style={{ color: message.ok ? "var(--success)" : "var(--brand-primary)" }}>
            {message.text}
          </span>
        )}
        <div className="ml-auto">{saveButtons}</div>
      </div>

      {editingRow && (
        <CompetitionModal
          key={editingRow.id}
          row={editingRow}
          current={current(editingRow)}
          countries={countries}
          matchDrafts={matchDrafts}
          matchCache={matchCache[editingRow.id]}
          onMatchesLoaded={onMatchesLoaded}
          onConfirm={(values, targets) => confirmEdit(editingRow, values, targets)}
          onRevert={() => revert(editingRow.id)}
          onClose={closeModal}
        />
      )}
    </>
  );
}
