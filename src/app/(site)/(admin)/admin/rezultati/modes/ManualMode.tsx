"use client";

import { useEffect, useCallback, useState } from "react";
import type { ReviewRow, DisciplineCode } from "@/lib/pdf-import/types";
import { CompetitionSearchSelect, type CompetitionOption } from "@/components/ui/CompetitionSearchSelect";
import { DonePanel } from "../_shared/DonePanel";
import { NocCellSelect } from "@/components/ui/NocCellSelect";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/competition-utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_DISCIPLINES: DisciplineCode[] = [
  "ARM", "ARW", "APM", "APW", "ARMT", "APMT", "R3PM", "R3PW", "SPW",
];

const MULTI_SERIES = new Set<DisciplineCode>(["ARM", "ARW", "APM", "APW", "R3PM", "R3PW"]);
const THREE_POS    = new Set<DisciplineCode>(["R3PM", "R3PW"]);
const MIXED_TEAM   = new Set<DisciplineCode>(["ARMT", "APMT"]);

const THREE_POS_STANCES = [
  { label: "Klečeći", abbr: "KN", indices: [0, 1] },
  { label: "Ležeći",  abbr: "PR", indices: [2, 3] },
  { label: "Stojeći", abbr: "ST", indices: [4, 5] },
] as const;

const SPW_GROUPS = [
  { label: "Precizno", indices: [0, 1, 2] as number[] },
  { label: "Brzo",     indices: [3, 4, 5] as number[] },
];

const DISC_LABEL: Record<DisciplineCode, string> = {
  ARM:  "10m Air Rifle Men",
  ARW:  "10m Air Rifle Women",
  APM:  "10m Air Pistol Men",
  APW:  "10m Air Pistol Women",
  ARMT: "10m Air Rifle Mixed Team",
  APMT: "10m Air Pistol Mixed Team",
  R3PM: "50m Rifle 3 Positions Men",
  R3PW: "50m Rifle 3 Positions Women",
  SPW:  "25m Sport Pistol Women",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId: number;
}

/** One team entry for ARMT/APMT manual input */
interface MixedEntry {
  nocCode: string;
  skip: boolean;
  qualRank: number | null;
  m_lastName: string;
  m_firstName: string;
  m_series: number[];
  f_lastName: string;
  f_firstName: string;
  f_series: number[];
  mTotal: number;
  fTotal: number;
  qualTotal: number;
  qualified: boolean | null;
  // finals
  finalRank: number | null;
  finalTotal: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSeries(disc: DisciplineCode): number[] | undefined {
  return MULTI_SERIES.has(disc) ? [0, 0, 0, 0, 0, 0] : undefined;
}

function makeRow(disc: DisciplineCode = "ARM", prevNoc = "SRB"): ReviewRow {
  return {
    firstName: "", lastName: "", teamNoc: prevNoc,
    disciplineCode: disc, category: "senior",
    qualTotal: 0, qualSeries: makeSeries(disc), qualRank: undefined, skip: false,
    finalTotal: null, finalRank: null,
  };
}

function makeMixedEntry(prevNoc = "SRB"): MixedEntry {
  return {
    nocCode: prevNoc, skip: false, qualRank: null,
    m_lastName: "", m_firstName: "", m_series: [0, 0, 0],
    f_lastName: "", f_firstName: "", f_series: [0, 0, 0],
    mTotal: 0, fTotal: 0, qualTotal: 0, qualified: null,
    finalRank: null, finalTotal: null,
  };
}

function seriesSum(series: number[]): number {
  return parseFloat(series.reduce((a, b) => a + (b ?? 0), 0).toFixed(1));
}

function computeRanks(rows: ReviewRow[], byFinal: boolean): ReviewRow[] {
  return rows.map((row) => {
    if (row.skip) return row;
    const score = byFinal ? (row.finalTotal ?? 0) : (row.qualTotal ?? 0);
    const rank = rows.filter((r) => !r.skip && ((byFinal ? (r.finalTotal ?? 0) : (r.qualTotal ?? 0)) > score)).length + 1;
    return byFinal ? { ...row, finalRank: rank } : { ...row, qualRank: rank };
  });
}

function computeMixedRanks(entries: MixedEntry[], byFinal: boolean): MixedEntry[] {
  return entries.map((e) => {
    if (e.skip) return e;
    const score = byFinal ? (e.finalTotal ?? 0) : e.qualTotal;
    const rank = entries.filter((x) => !x.skip && ((byFinal ? (x.finalTotal ?? 0) : x.qualTotal) > score)).length + 1;
    return byFinal ? { ...e, finalRank: rank } : { ...e, qualRank: rank };
  });
}

interface SeriesConstraints { step: number; maxSeries: number; maxTotal: number; placeholder: string }

function getConstraints(disc: DisciplineCode, finals: boolean): SeriesConstraints {
  const dec = (maxSeries: number, maxTotal: number): SeriesConstraints =>
    ({ step: 0.1, maxSeries, maxTotal, placeholder: "0.0" });
  const int = (maxSeries: number, maxTotal: number): SeriesConstraints =>
    ({ step: 1, maxSeries, maxTotal, placeholder: "0" });
  if (disc === "ARM" || disc === "ARW")   return finals ? dec(54.5, 261.6)  : dec(109.0, 654.0);
  if (disc === "APM" || disc === "APW")   return finals ? dec(54.5, 261.6)  : int(100, 600);
  if (disc === "R3PM" || disc === "R3PW") return finals ? dec(54.5, 381.5)  : int(100, 600);
  return int(100, 600);
}

function getMixedSeriesConstraints(disc: DisciplineCode): SeriesConstraints {
  return disc === "ARMT"
    ? { step: 0.1, maxSeries: 109.0, maxTotal: 654.0, placeholder: "0.0" }
    : { step: 1,   maxSeries: 100,   maxTotal: 300,   placeholder: "0" };
}

function rowHasSeries(row: ReviewRow): boolean {
  return !!row.qualSeries?.some((v) => v > 0);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT_BORDERLESS =
  "w-full border-0 border-b border-[var(--border)] bg-transparent px-1 py-0.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors placeholder:text-[var(--subtle)] disabled:opacity-40";

const INPUT_BOX =
  "border border-[var(--border)] rounded bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors placeholder:text-[var(--subtle)] tabular-nums font-[family-name:var(--font-jetbrains-mono)] disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden";

const TH =
  "px-2 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] select-none whitespace-nowrap";

const TD = "px-1.5 py-1.5 align-middle";

// ── Main component ────────────────────────────────────────────────────────────

export function ManualMode() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState<CommitResult | null>(null);

  const [discipline, setDiscipline]     = useState<DisciplineCode>("ARM");
  const [isFinals, setIsFinals]         = useState(false);
  const [selectedComp, setSelectedComp] = useState<CompetitionOption | null>(null);

  // Individual rows
  const [rows, setRows] = useState<ReviewRow[]>([makeRow("ARM")]);

  // Mixed team entries
  const [mixedEntries, setMixedEntries] = useState<MixedEntry[]>([makeMixedEntry()]);

  const isMixedTeam  = MIXED_TEAM.has(discipline);
  const isMultiSeries = MULTI_SERIES.has(discipline);
  const isThreePos    = THREE_POS.has(discipline);
  const isSportPistol = discipline === "SPW";
  const constraints   = getConstraints(discipline, isFinals);
  const mixedCons     = getMixedSeriesConstraints(discipline);

  // ── Individual: sync series on discipline change ──────────────────────────

  useEffect(() => {
    if (isMixedTeam) return;
    const multi = MULTI_SERIES.has(discipline);
    void Promise.resolve().then(() =>
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          disciplineCode: discipline,
          qualSeries: multi
            ? row.qualSeries?.length === 6 ? row.qualSeries : [0, 0, 0, 0, 0, 0]
            : undefined,
          qualTotal: multi
            ? row.qualSeries?.length === 6 ? seriesSum(row.qualSeries) : 0
            : row.qualTotal,
        }))
      )
    );
  }, [discipline, isMixedTeam]);

  // ── Individual: auto-recompute total from series ──────────────────────────

  useEffect(() => {
    if (!isMultiSeries || isMixedTeam || isFinals) return;
    void Promise.resolve().then(() =>
      setRows((prev) => {
        const next = prev.map((row) => {
          if (row.skip || !row.qualSeries || !rowHasSeries(row)) return row;
          const total = seriesSum(row.qualSeries);
          return total !== row.qualTotal ? { ...row, qualTotal: total } : row;
        });
        return next.some((r, i) => r.qualTotal !== prev[i].qualTotal) ? next : prev;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rows.map((r) => r.qualSeries)), isMultiSeries, isMixedTeam, isFinals]);

  // ── Individual: auto-recompute ranks ─────────────────────────────────────

  useEffect(() => {
    if (isMixedTeam) return;
    void Promise.resolve().then(() =>
      setRows((prev) => {
        const next = computeRanks(prev, isFinals);
        const changed = isFinals
          ? next.some((r, i) => r.finalRank !== prev[i].finalRank)
          : next.some((r, i) => r.qualRank  !== prev[i].qualRank);
        return changed ? next : prev;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rows.map((r) => ({ t: r.qualTotal, f: r.finalTotal, s: r.skip }))), isMixedTeam, isFinals]);

  // ── Mixed: auto-compute totals + ranks ────────────────────────────────────

  useEffect(() => {
    if (!isMixedTeam || isFinals) return;
    setMixedEntries((prev) => {
      const next = prev.map((e) => {
        if (e.skip) return e;
        const mTotal = seriesSum(e.m_series);
        const fTotal = seriesSum(e.f_series);
        const qualTotal = seriesSum([mTotal, fTotal]);
        return (mTotal === e.mTotal && fTotal === e.fTotal && qualTotal === e.qualTotal)
          ? e : { ...e, mTotal, fTotal, qualTotal };
      });
      const withRanks = computeMixedRanks(next, false);
      return withRanks.some((e, i) => e.qualRank !== prev[i].qualRank || e.qualTotal !== prev[i].qualTotal)
        ? withRanks : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(mixedEntries.map((e) => ({ ms: e.m_series, fs: e.f_series, s: e.skip }))), isMixedTeam, isFinals]);

  // ── Mixed: auto-compute final ranks ──────────────────────────────────────

  useEffect(() => {
    if (!isMixedTeam || !isFinals) return;
    setMixedEntries((prev) => {
      const next = computeMixedRanks(prev, true);
      return next.some((e, i) => e.finalRank !== prev[i].finalRank) ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(mixedEntries.map((e) => ({ f: e.finalTotal, s: e.skip }))), isMixedTeam, isFinals]);

  // ── Individual row mutations ──────────────────────────────────────────────

  const updateRow = useCallback((idx: number, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const updateSeries = useCallback((rowIdx: number, sIdx: number, value: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, qualSeries: (r.qualSeries ?? [0, 0, 0, 0, 0, 0]).map((s, j) => j === sIdx ? value : s) }
          : r
      )
    );
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, makeRow(discipline, last?.teamNoc ?? "SRB")];
    });
  }, [discipline]);

  const removeRow     = useCallback((idx: number) => setRows((p) => p.filter((_, i) => i !== idx)), []);
  const duplicateRow  = useCallback((idx: number) => {
    setRows((prev) => {
      const row = prev[idx];
      return [...prev.slice(0, idx + 1), { ...row, firstName: "", lastName: "" }, ...prev.slice(idx + 1)];
    });
  }, []);

  // ── Mixed entry mutations ─────────────────────────────────────────────────

  const updateMixed = useCallback((idx: number, patch: Partial<MixedEntry>) => {
    setMixedEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }, []);

  const updateMixedSeries = useCallback((eIdx: number, shooter: "m" | "f", sIdx: number, value: number) => {
    setMixedEntries((prev) =>
      prev.map((e, i) => {
        if (i !== eIdx) return e;
        const key = shooter === "m" ? "m_series" : "f_series";
        return { ...e, [key]: e[key].map((v, j) => j === sIdx ? value : v) };
      })
    );
  }, []);

  const addMixedEntry = useCallback(() => {
    setMixedEntries((prev) => [...prev, makeMixedEntry(prev[prev.length - 1]?.nocCode ?? "SRB")]);
  }, []);

  const removeMixedEntry = useCallback((idx: number) => {
    setMixedEntries((p) => p.filter((_, i) => i !== idx));
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedComp) { setError("Izaberi takmičenje."); return; }
    setLoading(true); setError(null);
    try {
      if (isMixedTeam) {
        const active = mixedEntries.filter((e) => !e.skip && e.nocCode);
        if (active.length === 0) { setError("Nema aktivnih timova."); return; }
        const res = await fetch("/api/admin/import/commit-mixed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competitionId: selectedComp.id, discipline, isFinals, entries: active }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Greška.");
        setDone({ ...data, competitionId: selectedComp.id });
      } else {
        const active = rows.filter((r) => !r.skip && r.firstName && r.lastName);
        if (active.length === 0) { setError("Nema aktivnih redova."); return; }
        const res = await fetch("/api/admin/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitionId: selectedComp.id,
            competition: { name: selectedComp.name, date: selectedComp.date, location: selectedComp.location ?? undefined, level: selectedComp.level },
            discipline, isFinals, rows: active,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Greška pri unosu.");
        setDone(data);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDone(null); setError(null); setSelectedComp(null);
    setRows([makeRow(discipline)]); setMixedEntries([makeMixedEntry()]);
  }

  if (done) return <DonePanel result={done} onReset={reset} resetLabel="Unesi još jedno takmičenje" />;

  const activeCount = isMixedTeam
    ? mixedEntries.filter((e) => !e.skip && e.nocCode).length
    : rows.filter((r) => !r.skip && r.firstName && r.lastName).length;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Top panel ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {/* Competition */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--muted)]">Takmičenje</p>
            {selectedComp && (
              <button onClick={() => setSelectedComp(null)} className="text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors">Promeni ×</button>
            )}
          </div>
          {selectedComp ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[var(--ink)] leading-snug truncate">{selectedComp.name}</p>
                <p className="text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] mt-0.5">
                  {selectedComp.date}{selectedComp.location ? ` · ${selectedComp.location}` : ""}
                </p>
              </div>
              <span
                className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)] whitespace-nowrap mt-0.5"
                style={LEVEL_STYLE[selectedComp.level] ?? { background: "#f3f4f6", color: "#4b5563" }}
              >
                {LEVEL_LABEL[selectedComp.level] ?? selectedComp.level}
              </span>
            </div>
          ) : (
            <CompetitionSearchSelect value={null} onChange={setSelectedComp} placeholder="Pretraži takmičenje…" />
          )}
        </div>

        {/* Discipline + Finals */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-[var(--muted)] shrink-0">Disciplina</span>
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {ALL_DISCIPLINES.map((d) => (
                <button
                  key={d}
                  onClick={() => { setDiscipline(d); setRows([makeRow(d)]); setMixedEntries([makeMixedEntry()]); }}
                  className="px-2 py-0.5 rounded text-xs font-bold transition-colors font-[family-name:var(--font-jetbrains-mono)]"
                  style={
                    discipline === d
                      ? { background: MIXED_TEAM.has(d) ? "var(--brand-accent, #7c3aed)" : "var(--ink)", color: "var(--bg)" }
                      : { background: "var(--surface-2)", color: "var(--muted)" }
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <CustomCheckbox checked={isFinals} onChange={setIsFinals} label="Finale" className="text-[var(--muted)]" />
          </div>
          <p className="text-xs text-[var(--muted)] font-medium">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)]">{discipline}</span>
            <span className="mx-1.5 text-[var(--border-strong)]">·</span>
            {DISC_LABEL[discipline]}
            {isMixedTeam && <span className="ml-2 text-[0.65rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] uppercase tracking-wider">· 3 serije × 10 po strelcu</span>}
          </p>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      {isMixedTeam ? (
        <MixedTeamTable
          entries={mixedEntries}
          isFinals={isFinals}
          discipline={discipline}
          constraints={mixedCons}
          onUpdate={updateMixed}
          onUpdateSeries={updateMixedSeries}
          onAdd={addMixedEntry}
          onRemove={removeMixedEntry}
        />
      ) : (
        <IndividualTable
          rows={rows}
          discipline={discipline}
          isFinals={isFinals}
          isMultiSeries={isMultiSeries}
          isThreePos={isThreePos}
          isSportPistol={isSportPistol}
          constraints={constraints}
          onUpdate={updateRow}
          onUpdateSeries={updateSeries}
          onAdd={addRow}
          onRemove={removeRow}
          onDuplicate={duplicateRow}
          onClear={() => setRows([makeRow(discipline)])}
          activeCount={activeCount}
        />
      )}

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSubmit}
          disabled={loading || activeCount === 0 || !selectedComp}
          className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Unosim…" : `Sačuvaj ${activeCount} ${isMixedTeam ? "timova" : "rezultata"} →`}
        </button>
        <button
          onClick={reset}
          className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
        >
          Resetuj
        </button>
        {!selectedComp && <p className="text-xs text-[var(--subtle)]">Izaberi takmičenje pre slanja.</p>}
      </div>
    </div>
  );
}

// ── Individual table ──────────────────────────────────────────────────────────

function IndividualTable({
  rows, discipline, isFinals, isMultiSeries, isThreePos, isSportPistol,
  constraints, onUpdate, onUpdateSeries, onAdd, onRemove, onDuplicate, onClear, activeCount,
}: {
  rows: ReviewRow[];
  discipline: DisciplineCode;
  isFinals: boolean;
  isMultiSeries: boolean;
  isThreePos: boolean;
  isSportPistol: boolean;
  constraints: SeriesConstraints;
  onUpdate: (idx: number, patch: Partial<ReviewRow>) => void;
  onUpdateSeries: (rowIdx: number, sIdx: number, value: number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onClear: () => void;
  activeCount: number;
}) {
  // When isFinals: simplified table (no series, just finalTotal + finalRank)
  if (isFinals) {
    return (
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Toolbar */}
        <div
          className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-2"
          style={{ background: "color-mix(in oklch, var(--brand-accent, #7c3aed) 8%, var(--surface))" }}
        >
          <span
            className="text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded font-[family-name:var(--font-barlow-condensed)]"
            style={{ background: "var(--brand-accent, #7c3aed)", color: "#fff", letterSpacing: "0.1em" }}
          >
            FINALE
          </span>
          <span className="text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)] font-[family-name:var(--font-jetbrains-mono)]">{activeCount}</span>
            {" "}za unos
          </span>
          <button onClick={onClear} className="ml-auto text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors px-2 py-0.5 rounded hover:bg-[var(--surface-2)]">
            Obriši sve
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: "560px" }}>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className={TH} style={{ width: 28 }} />
                <th className={`${TH} text-center`} style={{ width: 36 }}>#</th>
                <th className={TH}>Prezime</th>
                <th className={TH}>Ime</th>
                <th className={TH} style={{ width: 80 }}>Klub</th>
                <th className={`${TH} text-center`} style={{ width: 46 }}>NOC</th>
                <th className={`${TH} text-right`} style={{ width: 90, borderLeft: "1px solid var(--border)" }}>F-Ukupno</th>
                <th className={TH} style={{ width: 52 }} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row, idx) => (
                <tr key={idx} className="group transition-colors hover:bg-[var(--surface)]" style={{ opacity: row.skip ? 0.45 : 1 }}>
                  <td className={TD}>
                    <SkipButton skip={!!row.skip} onToggle={() => onUpdate(idx, { skip: !row.skip })} />
                  </td>
                  <td className={`${TD} text-center`}>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums font-bold text-[var(--muted)]">
                      {row.skip ? "—" : (row.finalRank ?? "—")}
                    </span>
                  </td>
                  <td className={TD}>
                    <input value={row.lastName} onChange={(e) => onUpdate(idx, { lastName: e.target.value })}
                      disabled={row.skip} placeholder="Prezime" className={INPUT_BORDERLESS} />
                  </td>
                  <td className={TD}>
                    <input value={row.firstName} onChange={(e) => onUpdate(idx, { firstName: e.target.value })}
                      disabled={row.skip} placeholder="Ime" className={INPUT_BORDERLESS} />
                  </td>
                  <td className={TD}>
                    <input value={row.clubAbbr ?? ""} onChange={(e) => onUpdate(idx, { clubAbbr: e.target.value })}
                      disabled={row.skip} placeholder="SKP" className={INPUT_BORDERLESS} />
                  </td>
                  <td className={`${TD} text-center`}>
                    <NocCellSelect value={row.teamNoc} onChange={(v) => onUpdate(idx, { teamNoc: v })} disabled={row.skip} />
                  </td>
                  <td className={`${TD} text-right`} style={{ borderLeft: "1px solid var(--border)" }}>
                    <input
                      type="number"
                      value={row.finalTotal ?? ""}
                      onChange={(e) => onUpdate(idx, { finalTotal: parseFloat(e.target.value) || null })}
                      disabled={row.skip}
                      placeholder={constraints.placeholder}
                      step={constraints.step}
                      min={0}
                      max={constraints.maxTotal}
                      className={`${INPUT_BOX} text-right`}
                      style={{ width: "80px" }}
                    />
                  </td>
                  <td className={TD}>
                    <RowActions idx={idx} total={rows.length} onDuplicate={onDuplicate} onRemove={onRemove} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[var(--border)] px-3 py-2">
          <AddRowButton onClick={onAdd} label="Dodaj strelca" />
        </div>
      </div>
    );
  }

  // Qual table (existing)
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-2">
        <span className="text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)] font-[family-name:var(--font-jetbrains-mono)]">{activeCount}</span>
          {" "}za unos
          <span className="text-[var(--subtle)]"> · {rows.length} redova</span>
        </span>
        {isMultiSeries && (
          <span className="text-[0.65rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] uppercase tracking-wide">
            · {discipline} / 6 serija · ukupno se računa automatski
          </span>
        )}
        <button onClick={onClear} className="ml-auto text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors px-2 py-0.5 rounded hover:bg-[var(--surface-2)]">
          Obriši sve
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: isMultiSeries ? "920px" : "620px" }}>
          <thead>
            {isThreePos && (
              <tr className="bg-[var(--surface-2)]">
                <th colSpan={6} />
                {THREE_POS_STANCES.map((s) => (
                  <th key={s.abbr} colSpan={2} className="px-2 py-1 text-center text-[0.6rem] font-bold uppercase tracking-widest text-[var(--muted)] border-l border-[var(--border)]">
                    {s.label}
                  </th>
                ))}
                <th colSpan={3} className="border-l border-[var(--border)]" />
              </tr>
            )}
            {isSportPistol && (
              <tr className="bg-[var(--surface-2)]">
                <th colSpan={6} />
                {SPW_GROUPS.map((g) => (
                  <th key={g.label} colSpan={3} className="px-2 py-1 text-center text-[0.6rem] font-bold uppercase tracking-widest text-[var(--muted)] border-l border-[var(--border)]">
                    {g.label}
                  </th>
                ))}
                <th colSpan={3} className="border-l border-[var(--border)]" />
              </tr>
            )}
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th className={TH} style={{ width: 28 }} />
              <th className={`${TH} text-center`} style={{ width: 36 }}>#</th>
              <th className={TH}>Prezime</th>
              <th className={TH}>Ime</th>
              <th className={TH} style={{ width: 80 }}>Klub</th>
              <th className={`${TH} text-center`} style={{ width: 46 }}>NOC</th>
              {isMultiSeries && !isSportPistol && [0,1,2,3,4,5].map((n) => (
                <th key={n} className={`${TH} text-center`} style={{ width: 54, borderLeft: (n === 0 || (isThreePos && n % 2 === 0)) ? "1px solid var(--border)" : undefined }}>
                  S{n + 1}
                </th>
              ))}
              {isSportPistol && SPW_GROUPS.map((g) =>
                g.indices.map((sIdx, i) => (
                  <th key={sIdx} className={`${TH} text-center`} style={{ width: 54, borderLeft: i === 0 ? "1px solid var(--border)" : undefined }}>
                    S{sIdx + 1}
                  </th>
                ))
              )}
              <th className={`${TH} text-right`} style={{ width: 72, borderLeft: (isSportPistol || isThreePos || isMultiSeries) ? "1px solid var(--border)" : undefined }}>Ukupno</th>
              <th className={`${TH} text-right`} style={{ width: 52 }}>Inn.</th>
              <th className={TH} style={{ width: 52 }} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row, idx) => (
              <tr key={idx} className="group transition-colors hover:bg-[var(--surface)]" style={{ opacity: row.skip ? 0.45 : 1 }}>
                <td className={TD}>
                  <SkipButton skip={!!row.skip} onToggle={() => onUpdate(idx, { skip: !row.skip })} />
                </td>
                <td className={`${TD} text-center`}>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums font-bold text-[var(--muted)]">
                    {row.skip ? "—" : (row.qualRank ?? "—")}
                  </span>
                </td>
                <td className={TD}>
                  <input value={row.lastName} onChange={(e) => onUpdate(idx, { lastName: e.target.value })} disabled={row.skip} placeholder="Prezime" className={INPUT_BORDERLESS} />
                </td>
                <td className={TD}>
                  <input value={row.firstName} onChange={(e) => onUpdate(idx, { firstName: e.target.value })} disabled={row.skip} placeholder="Ime" className={INPUT_BORDERLESS} />
                </td>
                <td className={TD}>
                  <input value={row.clubAbbr ?? ""} onChange={(e) => onUpdate(idx, { clubAbbr: e.target.value })} disabled={row.skip} placeholder="SKP" className={INPUT_BORDERLESS} />
                </td>
                <td className={`${TD} text-center`}>
                  <NocCellSelect value={row.teamNoc} onChange={(v) => onUpdate(idx, { teamNoc: v })} disabled={row.skip} />
                </td>
                {isMultiSeries && !isSportPistol && (row.qualSeries ?? [0,0,0,0,0,0]).map((val, sIdx) => (
                  <td key={sIdx} className={TD} style={{ borderLeft: (sIdx === 0 || (isThreePos && sIdx % 2 === 0)) ? "1px solid var(--border)" : undefined }}>
                    <input type="number" value={val || ""} onChange={(e) => onUpdateSeries(idx, sIdx, parseFloat(e.target.value) || 0)}
                      disabled={row.skip} placeholder={constraints.placeholder} step={constraints.step} min={0} max={constraints.maxSeries}
                      className={`${INPUT_BOX} w-full text-center`} />
                  </td>
                ))}
                {isSportPistol && SPW_GROUPS.map((g) => {
                  const series = row.qualSeries ?? [0,0,0,0,0,0];
                  return g.indices.map((sIdx, i) => (
                    <td key={sIdx} className={TD} style={{ borderLeft: i === 0 ? "1px solid var(--border)" : undefined }}>
                      <input type="number" value={series[sIdx] || ""} onChange={(e) => onUpdateSeries(idx, sIdx, parseFloat(e.target.value) || 0)}
                        disabled={row.skip} placeholder={constraints.placeholder} step={constraints.step} min={0} max={constraints.maxSeries}
                        className={`${INPUT_BOX} w-full text-center`} />
                    </td>
                  ));
                })}
                <td className={`${TD} text-right`} style={{ borderLeft: isMultiSeries ? "1px solid var(--border)" : undefined }}>
                  {isMultiSeries && rowHasSeries(row) ? (
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)] pr-1">
                      {row.qualTotal ? row.qualTotal.toFixed(1) : "—"}
                    </span>
                  ) : (
                    <input type="number" value={row.qualTotal || ""} onChange={(e) => onUpdate(idx, { qualTotal: parseFloat(e.target.value) || 0 })}
                      disabled={row.skip} placeholder={constraints.placeholder} step={constraints.step} min={0} max={constraints.maxTotal}
                      className={`${INPUT_BOX} text-right`} style={{ width: "68px" }} />
                  )}
                </td>
                <td className={`${TD} text-right`}>
                  <input type="number" value={row.qualInners ?? ""} onChange={(e) => onUpdate(idx, { qualInners: parseInt(e.target.value) || null })}
                    disabled={row.skip} placeholder="—" min={0} className={`${INPUT_BOX} text-right`} style={{ width: "42px" }} />
                </td>
                <td className={TD}>
                  <RowActions idx={idx} total={rows.length} onDuplicate={onDuplicate} onRemove={onRemove} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--border)] px-3 py-2">
        <AddRowButton onClick={onAdd} label="Dodaj strelca" />
      </div>
    </div>
  );
}

// ── Mixed team table ──────────────────────────────────────────────────────────

function MixedTeamTable({
  entries, isFinals, discipline, constraints, onUpdate, onUpdateSeries, onAdd, onRemove,
}: {
  entries: MixedEntry[];
  isFinals: boolean;
  discipline: DisciplineCode;
  constraints: SeriesConstraints;
  onUpdate: (idx: number, patch: Partial<MixedEntry>) => void;
  onUpdateSeries: (eIdx: number, shooter: "m" | "f", sIdx: number, value: number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  const activeCount = entries.filter((e) => !e.skip && e.nocCode).length;

  if (isFinals) {
    // Simplified finale table: rank | NOC | F-Ukupno | (actions)
    return (
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div
          className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-2"
          style={{ background: "color-mix(in oklch, var(--brand-accent, #7c3aed) 8%, var(--surface))" }}
        >
          <span
            className="text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded font-[family-name:var(--font-barlow-condensed)]"
            style={{ background: "var(--brand-accent, #7c3aed)", color: "#fff" }}
          >
            FINALE · MEŠOVITI TIM
          </span>
          <span className="text-xs text-[var(--muted)] ml-1">
            <span className="font-semibold text-[var(--ink)] font-[family-name:var(--font-jetbrains-mono)]">{activeCount}</span> timova
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: "420px" }}>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className={TH} style={{ width: 28 }} />
                <th className={`${TH} text-center`} style={{ width: 36 }}>#</th>
                <th className={`${TH} text-center`} style={{ width: 64 }}>NOC</th>
                <th className={`${TH} text-right`} style={{ borderLeft: "1px solid var(--border)" }}>F-Ukupno</th>
                <th className={TH} style={{ width: 52 }} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {entries.map((e, idx) => (
                <tr key={idx} className="group hover:bg-[var(--surface)] transition-colors" style={{ opacity: e.skip ? 0.45 : 1 }}>
                  <td className={TD}>
                    <SkipButton skip={e.skip} onToggle={() => onUpdate(idx, { skip: !e.skip })} />
                  </td>
                  <td className={`${TD} text-center`}>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums font-bold text-[var(--muted)]">
                      {e.skip ? "—" : (e.finalRank ?? "—")}
                    </span>
                  </td>
                  <td className={`${TD} text-center`}>
                    <NocCellSelect value={e.nocCode} onChange={(v) => onUpdate(idx, { nocCode: v })} disabled={e.skip} />
                  </td>
                  <td className={`${TD} text-right`} style={{ borderLeft: "1px solid var(--border)" }}>
                    <input
                      type="number"
                      value={e.finalTotal ?? ""}
                      onChange={(ev) => onUpdate(idx, { finalTotal: parseFloat(ev.target.value) || null })}
                      disabled={e.skip}
                      placeholder={constraints.placeholder}
                      step={constraints.step}
                      min={0}
                      max={constraints.maxTotal * 2}
                      className={`${INPUT_BOX} text-right`}
                      style={{ width: "90px" }}
                    />
                  </td>
                  <td className={TD}>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => onRemove(idx)} disabled={entries.length === 1}
                        className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30">
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[var(--border)] px-3 py-2">
          <AddRowButton onClick={onAdd} label="Dodaj tim" />
        </div>
      </div>
    );
  }

  // Qual table: side-by-side M + F with 3 series each
  const isAR = discipline === "ARMT";

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-2">
        <span className="text-[0.65rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] uppercase tracking-wide">
          Mešoviti tim · 3 serije × {isAR ? "10.9 (decimal)" : "100 (int)"} po strelcu · ukupno automatski
        </span>
        <span className="ml-auto text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)] font-[family-name:var(--font-jetbrains-mono)]">{activeCount}</span> timova
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: "1060px" }}>
          <thead>
            {/* Group header row */}
            <tr className="bg-[var(--surface-2)]">
              <th colSpan={3} />
              {/* Male group */}
              <th colSpan={5} className="px-2 py-1 text-center text-[0.6rem] font-bold uppercase tracking-widest border-l border-[var(--border)]" style={{ color: "#3b82f6" }}>
                Muški (M)
              </th>
              {/* Female group */}
              <th colSpan={5} className="px-2 py-1 text-center text-[0.6rem] font-bold uppercase tracking-widest border-l border-[var(--border)]" style={{ color: "#ec4899" }}>
                Ženski (Ž)
              </th>
              <th colSpan={3} className="border-l border-[var(--border)]" />
            </tr>

            {/* Column header row */}
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th className={TH} style={{ width: 28 }} />
              <th className={`${TH} text-center`} style={{ width: 36 }}>#</th>
              <th className={`${TH} text-center`} style={{ width: 60 }}>NOC</th>

              {/* Male columns */}
              <th className={TH} style={{ width: 90, borderLeft: "1px solid var(--border)" }}>Prezime M</th>
              <th className={TH} style={{ width: 80 }}>Ime M</th>
              {[0,1,2].map((n) => (
                <th key={n} className={`${TH} text-center`} style={{ width: 52 }}>S{n+1}</th>
              ))}
              <th className={`${TH} text-right`} style={{ width: 62, borderLeft: "1px solid var(--border)" }}>Σ M</th>

              {/* Female columns */}
              <th className={TH} style={{ width: 90, borderLeft: "1px solid var(--border)" }}>Prezime Ž</th>
              <th className={TH} style={{ width: 80 }}>Ime Ž</th>
              {[0,1,2].map((n) => (
                <th key={n} className={`${TH} text-center`} style={{ width: 52 }}>S{n+1}</th>
              ))}
              <th className={`${TH} text-right`} style={{ width: 62, borderLeft: "1px solid var(--border)" }}>Σ Ž</th>

              {/* Team total + finals qualifier */}
              <th className={`${TH} text-right`} style={{ width: 72, borderLeft: "1px solid var(--border)" }}>Tim Σ</th>
              <th className={`${TH} text-center`} style={{ width: 36 }}>F</th>
              <th className={TH} style={{ width: 52 }} />
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {entries.map((e, idx) => (
              <tr key={idx} className="group hover:bg-[var(--surface)] transition-colors" style={{ opacity: e.skip ? 0.45 : 1 }}>
                <td className={TD}>
                  <SkipButton skip={e.skip} onToggle={() => onUpdate(idx, { skip: !e.skip })} />
                </td>
                <td className={`${TD} text-center`}>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums font-bold text-[var(--muted)]">
                    {e.skip ? "—" : (e.qualRank ?? "—")}
                  </span>
                </td>
                <td className={`${TD} text-center`}>
                  <NocCellSelect value={e.nocCode} onChange={(v) => onUpdate(idx, { nocCode: v })} disabled={e.skip} />
                </td>

                {/* Male shooter */}
                <td className={TD} style={{ borderLeft: "1px solid var(--border)" }}>
                  <input value={e.m_lastName} onChange={(ev) => onUpdate(idx, { m_lastName: ev.target.value })}
                    disabled={e.skip} placeholder="Prezime" className={INPUT_BORDERLESS} />
                </td>
                <td className={TD}>
                  <input value={e.m_firstName} onChange={(ev) => onUpdate(idx, { m_firstName: ev.target.value })}
                    disabled={e.skip} placeholder="Ime" className={INPUT_BORDERLESS} />
                </td>
                {e.m_series.map((val, sIdx) => (
                  <td key={sIdx} className={TD}>
                    <input type="number" value={val || ""} onChange={(ev) => onUpdateSeries(idx, "m", sIdx, parseFloat(ev.target.value) || 0)}
                      disabled={e.skip} placeholder={constraints.placeholder} step={constraints.step} min={0} max={constraints.maxSeries}
                      className={`${INPUT_BOX} w-full text-center`} />
                  </td>
                ))}
                <td className={`${TD} text-right`} style={{ borderLeft: "1px solid var(--border)" }}>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)]">
                    {e.mTotal > 0 ? (isAR ? e.mTotal.toFixed(1) : e.mTotal) : <span className="text-[var(--subtle)] font-normal">—</span>}
                  </span>
                </td>

                {/* Female shooter */}
                <td className={TD} style={{ borderLeft: "1px solid var(--border)" }}>
                  <input value={e.f_lastName} onChange={(ev) => onUpdate(idx, { f_lastName: ev.target.value })}
                    disabled={e.skip} placeholder="Prezime" className={INPUT_BORDERLESS} />
                </td>
                <td className={TD}>
                  <input value={e.f_firstName} onChange={(ev) => onUpdate(idx, { f_firstName: ev.target.value })}
                    disabled={e.skip} placeholder="Ime" className={INPUT_BORDERLESS} />
                </td>
                {e.f_series.map((val, sIdx) => (
                  <td key={sIdx} className={TD}>
                    <input type="number" value={val || ""} onChange={(ev) => onUpdateSeries(idx, "f", sIdx, parseFloat(ev.target.value) || 0)}
                      disabled={e.skip} placeholder={constraints.placeholder} step={constraints.step} min={0} max={constraints.maxSeries}
                      className={`${INPUT_BOX} w-full text-center`} />
                  </td>
                ))}
                <td className={`${TD} text-right`} style={{ borderLeft: "1px solid var(--border)" }}>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)]">
                    {e.fTotal > 0 ? (isAR ? e.fTotal.toFixed(1) : e.fTotal) : <span className="text-[var(--subtle)] font-normal">—</span>}
                  </span>
                </td>

                {/* Team total */}
                <td className={`${TD} text-right`} style={{ borderLeft: "1px solid var(--border)" }}>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-base font-bold tabular-nums text-[var(--ink)]">
                    {e.qualTotal > 0 ? (isAR ? e.qualTotal.toFixed(1) : e.qualTotal) : <span className="text-[var(--subtle)] font-normal text-sm">—</span>}
                  </span>
                </td>

                {/* Qualified checkbox */}
                <td className={`${TD} text-center`}>
                  <input
                    type="checkbox"
                    checked={e.qualified === true}
                    onChange={(ev) => onUpdate(idx, { qualified: ev.target.checked ? true : null })}
                    disabled={e.skip}
                    className="w-3.5 h-3.5 accent-[var(--brand-primary)] cursor-pointer"
                  />
                </td>

                {/* Actions */}
                <td className={TD}>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button onClick={() => onRemove(idx)} disabled={entries.length === 1}
                      className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30">
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--border)] px-3 py-2">
        <AddRowButton onClick={onAdd} label="Dodaj tim" />
      </div>
    </div>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function SkipButton({ skip, onToggle }: { skip: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} title={skip ? "Aktiviraj" : "Preskoči"}
      className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-[var(--subtle)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors">
      {skip ? (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 5h6M5 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}

function RowActions({ idx, total, onDuplicate, onRemove }: { idx: number; total: number; onDuplicate: (i: number) => void; onRemove: (i: number) => void }) {
  return (
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
      <button onClick={() => onDuplicate(idx)} title="Dupliraj red"
        className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>
      <button onClick={() => onRemove(idx)} title="Obriši red" disabled={total === 1}
        className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30">
        <TrashIcon />
      </button>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 3h8M5 3V2h2v1M5 9.5V5M7 9.5V5M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors py-1 px-2 rounded hover:bg-[var(--surface)]">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {label}
    </button>
  );
}
