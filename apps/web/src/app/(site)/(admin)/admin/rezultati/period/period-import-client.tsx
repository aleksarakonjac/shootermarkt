"use client";

import { useState } from "react";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { formatDateRangeSr } from "@/lib/date-utils";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/competition-utils";
import type { SiusImportResult, SiusImportSummary } from "@/lib/sius-bulk";
import type { SiusMatch } from "@/lib/sius-match";

interface Comp {
  id: number;
  name: string;
  date: string;
  dateEnd: string | null;
  level: string;
  siusId: string | null;
  resultCount: number;
  teamCount: number;
  suggestion: SiusMatch | null;
}

type Preview = { state: "loading" } | { state: "ok"; data: SiusImportSummary } | { state: "error"; message: string };
type Outcome = { state: "running" } | { state: "done"; data: SiusImportResult } | { state: "error"; message: string };

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => String(THIS_YEAR - i)).map((y) => ({ value: y, label: y }));
const PREVIEW_CONCURRENCY = 3;

async function post<T>(body: object): Promise<T> {
  const res = await fetch("/api/admin/sius/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Greška ${res.status}`);
  return data as T;
}

/** Runs `task` over `items`, at most `limit` at a time. */
async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
  }));
}

export function PeriodImportClient() {
  const [fromYear, setFromYear] = useState(String(THIS_YEAR - 1));
  const [toYear, setToYear] = useState(String(THIS_YEAR));
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [importing, setImporting] = useState(false);
  const [linking, setLinking] = useState<Record<number, string | null>>({});

  async function load() {
    if (Number(fromYear) > Number(toYear)) { setError("Početna godina je posle krajnje."); return; }
    setLoading(true); setError(null); setPreviews({}); setSelected(new Set()); setOutcomes({});
    try {
      const res = await fetch(`/api/admin/sius/bulk?from=${fromYear}&to=${toYear}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setComps(data.competitions);
      setLookupFailed(data.siusLookupFailed);
      void loadPreviews((data.competitions as Comp[]).filter((c) => c.siusId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadPreviews(list: Comp[]) {
    setPreviews((prev) => ({ ...prev, ...Object.fromEntries(list.map((c) => [c.id, { state: "loading" } as Preview])) }));
    await pool(list, PREVIEW_CONCURRENCY, async (c) => {
      try {
        const data = await post<SiusImportSummary>({ action: "preview", competitionId: c.id });
        setPreviews((prev) => ({ ...prev, [c.id]: { state: "ok", data } }));
        // Pre-select whatever SIUS has more of than the DB — new or partial imports.
        if (data.rows + data.teams > c.resultCount + c.teamCount) setSelected((prev) => new Set(prev).add(c.id));
      } catch (e) {
        setPreviews((prev) => ({ ...prev, [c.id]: { state: "error", message: e instanceof Error ? e.message : String(e) } }));
      }
    });
  }

  async function link(c: Comp, siusId: string) {
    setLinking((prev) => ({ ...prev, [c.id]: null }));
    try {
      await post({ action: "link", competitionId: c.id, siusId });
      const linked = { ...c, siusId, suggestion: null };
      setComps((prev) => prev?.map((x) => (x.id === c.id ? linked : x)) ?? prev);
      setLinking((prev) => { const next = { ...prev }; delete next[c.id]; return next; });
      void loadPreviews([linked]);
    } catch (e) {
      setLinking((prev) => ({ ...prev, [c.id]: e instanceof Error ? e.message : String(e) }));
    }
  }

  async function importSelected() {
    const queue = (comps ?? []).filter((c) => selected.has(c.id));
    setImporting(true);
    // One at a time: each commit recomputes forma and writes hundreds of rows.
    for (const c of queue) {
      setOutcomes((prev) => ({ ...prev, [c.id]: { state: "running" } }));
      try {
        const data = await post<SiusImportResult>({ action: "import", competitionId: c.id });
        setOutcomes((prev) => ({ ...prev, [c.id]: { state: "done", data } }));
        setComps((prev) => prev?.map((x) => (x.id === c.id ? { ...x, resultCount: Math.max(x.resultCount, data.inserted), teamCount: Math.max(x.teamCount, data.teamsInserted) } : x)) ?? prev);
        setSelected((prev) => { const next = new Set(prev); next.delete(c.id); return next; });
      } catch (e) {
        setOutcomes((prev) => ({ ...prev, [c.id]: { state: "error", message: e instanceof Error ? e.message : String(e) } }));
      }
    }
    setImporting(false);
  }

  const withSius = comps?.filter((c) => c.siusId) ?? [];
  // Rows with a suggestion first — those are the ones worth a click.
  const withoutSius = (comps?.filter((c) => !c.siusId) ?? []).toSorted((a, b) => Number(!!b.suggestion) - Number(!!a.suggestion));
  const done = Object.values(outcomes).filter((o) => o.state !== "running").length;
  const total = Object.keys(outcomes).length;

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Uvoz rezultata za period</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Uvozi SIUS rezultate za sva takmičenja u izabranim godinama odjednom, uključujući mešane timove, DSQ/DNS i kazne.
          Već uvezeni rezultati se ažuriraju, ne dupliraju.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">Od godine</label>
          <SearchDropdown value={fromYear} onChange={(v) => v && setFromYear(v)} options={YEAR_OPTIONS} searchable={false} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">Do godine</label>
          <SearchDropdown value={toYear} onChange={(v) => v && setToYear(v)} options={YEAR_OPTIONS} searchable={false} />
        </div>
        <button type="button" onClick={load} disabled={loading || importing} className="min-h-11 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--brand-primary-hover)] disabled:opacity-50">
          {loading ? "Učitavam…" : "Učitaj takmičenja"}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-[var(--danger)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}

      {comps && (
        <>
          <section aria-labelledby="with-sius">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="with-sius" className="text-base font-semibold text-[var(--ink)]">
                Sa SIUS UUID-om <span className="font-normal text-[var(--muted)]">· {withSius.length}</span>
              </h2>
              <div className="flex items-center gap-3">
                {total > 0 && <span className="text-sm tabular-nums text-[var(--muted)]" aria-live="polite">{done}/{total} uvezeno</span>}
                <button type="button" onClick={importSelected} disabled={importing || selected.size === 0} className="min-h-11 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--brand-primary-hover)] disabled:opacity-50">
                  {importing ? "Uvozim…" : `Uvezi izabrana (${selected.size})`}
                </button>
              </div>
            </div>
            {total > 0 && (
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden="true">
                <div className="h-full bg-[var(--brand-primary)] transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            )}
            {withSius.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">Nijedno takmičenje u ovom periodu nema SIUS UUID. Poveži ih ispod.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {withSius.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Izaberi: ${c.name}`}
                      checked={selected.has(c.id)}
                      disabled={importing}
                      onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })}
                      className="mt-1 size-4 accent-[var(--brand-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{formatDateRangeSr(c.date, c.dateEnd)}</span>
                        <span className="text-sm font-medium text-[var(--ink)]">{c.name}</span>
                        <span className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold" style={LEVEL_STYLE[c.level]}>{LEVEL_LABEL[c.level] ?? c.level}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                        <span>U bazi: <span className="tabular-nums text-[var(--ink)]">{c.resultCount}</span> rez.{c.teamCount > 0 && <> · <span className="tabular-nums text-[var(--ink)]">{c.teamCount}</span> timova</>}</span>
                        <PreviewLine preview={previews[c.id]} />
                      </div>
                      <OutcomeLine outcome={outcomes[c.id]} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {withoutSius.length > 0 && (
            <section aria-labelledby="without-sius">
              <h2 id="without-sius" className="mb-1 text-base font-semibold text-[var(--ink)]">
                Bez SIUS UUID-a <span className="font-normal text-[var(--muted)]">· {withoutSius.length}</span>
              </h2>
              <p className="mb-3 text-sm text-[var(--muted)]">
                {lookupFailed
                  ? "SIUS lista takmičenja trenutno nije dostupna, predlozi nisu učitani."
                  : "Domaća takmičenja uglavnom nemaju javne SIUS rezultate. Poveži samo ona gde predlog odgovara."}
              </p>
              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {withoutSius.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{formatDateRangeSr(c.date, c.dateEnd)}</span>
                        <span className="text-sm text-[var(--ink)]">{c.name}</span>
                      </div>
                      {c.suggestion ? (
                        <p className={`mt-0.5 text-xs ${c.suggestion.confident ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                          {c.suggestion.confident ? "Predlog" : "Mogući SIUS (nesiguran)"}: {c.suggestion.name}{c.suggestion.city ? ` · ${c.suggestion.city}` : ""} · {c.suggestion.start}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-[var(--subtle)]">Nema SIUS takmičenja u tim danima.</p>
                      )}
                      {linking[c.id] && <p role="alert" className="mt-0.5 text-xs text-[var(--danger)]">{linking[c.id]}</p>}
                    </div>
                    {c.suggestion && (
                      <button
                        type="button"
                        onClick={() => link(c, c.suggestion!.id)}
                        disabled={c.id in linking && linking[c.id] === null}
                        className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 ${c.suggestion.confident ? "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]" : "border border-[var(--border-strong)] text-[var(--ink)] hover:bg-[var(--surface-2)]"}`}
                      >
                        {c.id in linking && linking[c.id] === null ? "Povezujem…" : "Poveži"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PreviewLine({ preview }: { preview?: Preview }) {
  if (!preview) return null;
  if (preview.state === "loading") return <span className="inline-block h-3 w-40 animate-pulse rounded bg-[var(--surface-2)] align-middle motion-reduce:animate-none" aria-label="Učitavam SIUS" />;
  if (preview.state === "error") return <span className="text-[var(--danger)]">SIUS: {preview.message}</span>;
  const d = preview.data;
  return (
    <span>
      SIUS: <span className="tabular-nums text-[var(--ink)]">{d.rows}</span> rez.
      {d.teams > 0 && <> · <span className="tabular-nums text-[var(--ink)]">{d.teams}</span> timova</>}
      {d.newShooters > 0 && <> · <span className="tabular-nums text-[var(--ink)]">{d.newShooters}</span> novih strelaca</>}
      {d.unranked > 0 && <> · {d.unranked} DSQ/DNS</>}
      {d.withMarks > 0 && <> · {d.withMarks} kazna/SO/rekord</>}
      <span className="ml-1 text-[var(--subtle)]">({Object.keys(d.perDiscipline).join(", ")})</span>
    </span>
  );
}

function OutcomeLine({ outcome }: { outcome?: Outcome }) {
  if (!outcome) return null;
  if (outcome.state === "running") return <p className="mt-1 text-xs font-medium text-[var(--ink)]" aria-live="polite">Uvozim…</p>;
  if (outcome.state === "error") return <p role="alert" className="mt-1 text-xs text-[var(--danger)]">Greška: {outcome.message}</p>;
  const d = outcome.data;
  return (
    <p className="mt-1 text-xs text-[var(--success)]" aria-live="polite">
      Uvezeno {d.inserted} rez.{d.teamsInserted > 0 && `, ${d.teamsInserted} timova`}{d.skipped > 0 && `, preskočeno ${d.skipped}`}
      {d.errors.length > 0 && <span className="text-[var(--danger)]"> · {d.errors.length} grešaka: {d.errors.slice(0, 2).join("; ")}</span>}
    </p>
  );
}
