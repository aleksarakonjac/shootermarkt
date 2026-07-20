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
  "ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW",
];

const MULTI_SERIES = new Set<DisciplineCode>(["ARM", "ARW", "APM", "APW", "R3PM", "R3PW"]);

const THREE_POS = new Set<DisciplineCode>(["R3PM", "R3PW"]);

const THREE_POS_STANCES = [
  { label: "Klečeći",  abbr: "KN", indices: [0, 1] },
  { label: "Ležeći",   abbr: "PR", indices: [2, 3] },
  { label: "Stojeći",  abbr: "ST", indices: [4, 5] },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSeries(disc: DisciplineCode): number[] | undefined {
  return MULTI_SERIES.has(disc) ? [0, 0, 0, 0, 0, 0] : undefined;
}

function makeRow(disc: DisciplineCode = "ARM", prevNoc = "SRB"): ReviewRow {
  return {
    firstName: "",
    lastName: "",
    teamNoc: prevNoc,
    disciplineCode: disc,
    category: "senior",
    qualTotal: 0,
    qualSeries: makeSeries(disc),
    qualRank: undefined,
    skip: false,
  };
}

function seriesSum(series: number[]): number {
  return parseFloat(series.reduce((a, b) => a + (b ?? 0), 0).toFixed(1));
}

interface SeriesConstraints { step: number; maxSeries: number; maxTotal: number; placeholder: string }

function getConstraints(disc: DisciplineCode, finals: boolean): SeriesConstraints {
  const decimal = (maxSeries: number, maxTotal: number): SeriesConstraints =>
    ({ step: 0.1, maxSeries, maxTotal, placeholder: "0.0" });
  const integer = (maxSeries: number, maxTotal: number): SeriesConstraints =>
    ({ step: 1, maxSeries, maxTotal, placeholder: "0" });

  if (disc === "ARM" || disc === "ARW") {
    return finals ? decimal(54.5, 261.6) : decimal(109.0, 654.0);
  }
  if (disc === "APM" || disc === "APW") {
    return finals ? decimal(54.5, 261.6) : integer(100, 600);
  }
  if (disc === "R3PM" || disc === "R3PW") {
    return finals ? decimal(54.5, 381.5) : integer(100, 600);
  }
  // SPW — only qual defined
  return integer(100, 600);
}

function rowHasSeries(row: ReviewRow): boolean {
  return !!row.qualSeries?.some((v) => v > 0);
}

function computeRanks(rows: ReviewRow[]): ReviewRow[] {
  return rows.map((row) => {
    if (row.skip) return row;
    const rank =
      rows.filter((r) => !r.skip && (r.qualTotal ?? 0) > (row.qualTotal ?? 0)).length + 1;
    return { ...row, qualRank: rank };
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT_BORDERLESS =
  "w-full border-0 border-b border-[var(--border)] bg-transparent px-1 py-0.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors placeholder:text-[var(--subtle)] disabled:opacity-40";

const INPUT_BOX =
  "border border-[var(--border)] rounded bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors placeholder:text-[var(--subtle)] tabular-nums font-[family-name:var(--font-jetbrains-mono)] disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden";

const TH =
  "px-2 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] select-none whitespace-nowrap";

const TD = "px-1.5 py-1.5 align-middle";

// ── Component ─────────────────────────────────────────────────────────────────

export function ManualMode() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);

  const [discipline, setDiscipline] = useState<DisciplineCode>("ARM");
  const [isFinals, setIsFinals] = useState(false);
  const [selectedComp, setSelectedComp] = useState<CompetitionOption | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([makeRow("ARM")]);

  const isMultiSeries = MULTI_SERIES.has(discipline);
  const isThreePos = THREE_POS.has(discipline);
  const isSportPistol = discipline === "SPW";
  const constraints = getConstraints(discipline, isFinals);

  // When discipline changes: update series arrays on all rows
  useEffect(() => {
    const multi = MULTI_SERIES.has(discipline);
    void Promise.resolve().then(() =>
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          disciplineCode: discipline,
          qualSeries: multi
            ? row.qualSeries?.length === 6
              ? row.qualSeries
              : [0, 0, 0, 0, 0, 0]
            : undefined,
          qualTotal: multi
            ? row.qualSeries?.length === 6
              ? seriesSum(row.qualSeries)
              : 0
            : row.qualTotal,
        }))
      )
    );
  }, [discipline]);

  // Auto-recompute total from series — only for rows that have at least one series value
  useEffect(() => {
    if (!isMultiSeries) return;
    void Promise.resolve().then(() =>
      setRows((prev) => {
        const next = prev.map((row) => {
          if (row.skip || !row.qualSeries || !rowHasSeries(row)) return row;
          const total = seriesSum(row.qualSeries);
          return total !== row.qualTotal ? { ...row, qualTotal: total } : row;
        });
        const changed = next.some((r, i) => r.qualTotal !== prev[i].qualTotal);
        return changed ? next : prev;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rows.map((r) => r.qualSeries)), isMultiSeries]);

  // Auto-recompute ranks from totals
  useEffect(() => {
    void Promise.resolve().then(() =>
      setRows((prev) => {
        const next = computeRanks(prev);
        const changed = next.some((r, i) => r.qualRank !== prev[i].qualRank);
        return changed ? next : prev;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rows.map((r) => ({ t: r.qualTotal, s: r.skip })))]);

  // ── Row mutations ─────────────────────────────────────────────────────────

  const updateRow = useCallback((idx: number, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const updateSeries = useCallback((rowIdx: number, sIdx: number, value: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? {
              ...r,
              qualSeries: (r.qualSeries ?? [0, 0, 0, 0, 0, 0]).map((s, j) =>
                j === sIdx ? value : s
              ),
            }
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

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const duplicateRow = useCallback((idx: number) => {
    setRows((prev) => {
      const row = prev[idx];
      return [
        ...prev.slice(0, idx + 1),
        { ...row, firstName: "", lastName: "" },
        ...prev.slice(idx + 1),
      ];
    });
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedComp) { setError("Izaberi takmičenje."); return; }
    const activeRows = rows.filter((r) => !r.skip && r.firstName && r.lastName);
    if (activeRows.length === 0) { setError("Nema aktivnih redova sa imenom i prezimenom."); return; }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: selectedComp.id,
          competition: {
            name: selectedComp.name,
            date: selectedComp.date,
            location: selectedComp.location ?? undefined,
            level: selectedComp.level,
          },
          discipline,
          isFinals,
          rows: activeRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška pri unosu.");
      setDone(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDone(null);
    setError(null);
    setSelectedComp(null);
    setRows([makeRow(discipline)]);
  }

  if (done) {
    return (
      <DonePanel result={done} onReset={reset} resetLabel="Unesi još jedno takmičenje" />
    );
  }

  const activeCount = rows.filter((r) => !r.skip && r.firstName && r.lastName).length;
  return (
    <div className="space-y-5">

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Top panel: competition + discipline ──────────────────── */}
      <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">

        {/* Competition picker */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--muted)]">Takmičenje</p>
            {selectedComp && (
              <button
                onClick={() => setSelectedComp(null)}
                className="text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors"
              >
                Promeni ×
              </button>
            )}
          </div>

          {selectedComp ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[var(--ink)] leading-snug truncate">
                  {selectedComp.name}
                </p>
                <p className="text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] mt-0.5">
                  {selectedComp.date}
                  {selectedComp.location ? ` · ${selectedComp.location}` : ""}
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
                  onClick={() => setDiscipline(d)}
                  className="px-2 py-0.5 rounded text-xs font-bold transition-colors font-[family-name:var(--font-jetbrains-mono)]"
                  style={
                    discipline === d
                      ? { background: "var(--ink)", color: "var(--bg)" }
                      : { background: "var(--surface-2)", color: "var(--muted)" }
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <CustomCheckbox
              checked={isFinals}
              onChange={setIsFinals}
              label="Finale"
              className="text-[var(--muted)]"
            />
          </div>
          <p className="text-xs text-[var(--muted)] font-medium">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)]">{discipline}</span>
            <span className="mx-1.5 text-[var(--border-strong)]">·</span>
            {DISC_LABEL[discipline]}
          </p>
        </div>
      </div>

      {/* ── Results table ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">

        {/* Toolbar */}
        <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)] font-[family-name:var(--font-jetbrains-mono)]">
              {activeCount}
            </span>
            {" "}za unos
            <span className="text-[var(--subtle)]"> · {rows.length} redova</span>
          </span>
          {isMultiSeries && (
            <span className="text-[0.65rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] uppercase tracking-wide">
              · {discipline} / 6 serija · ukupno se računa automatski
            </span>
          )}
          <button
            onClick={() => setRows([makeRow(discipline)])}
            className="ml-auto text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors px-2 py-0.5 rounded hover:bg-[var(--surface-2)]"
          >
            Obriši sve
          </button>
        </div>

        <div className="overflow-x-auto">
          <table
            className="w-full"
            style={{ minWidth: isMultiSeries ? "920px" : "620px" }}
          >
            <thead>
              {isThreePos && (
                <tr className="bg-[var(--surface-2)]">
                  <th colSpan={6} />
                  {THREE_POS_STANCES.map((stance) => (
                    <th
                      key={stance.abbr}
                      colSpan={2}
                      className="px-2 py-1 text-center text-[0.6rem] font-bold uppercase tracking-widest text-[var(--muted)] border-l border-[var(--border)]"
                    >
                      {stance.label}
                    </th>
                  ))}
                  <th colSpan={3} className="border-l border-[var(--border)]" />
                </tr>
              )}
              {isSportPistol && (
                <tr className="bg-[var(--surface-2)]">
                  <th colSpan={6} />
                  {SPW_GROUPS.map((g) => (
                    <th
                      key={g.label}
                      colSpan={3}
                      className="px-2 py-1 text-center text-[0.6rem] font-bold uppercase tracking-widest text-[var(--muted)] border-l border-[var(--border)]"
                    >
                      {g.label}
                    </th>
                  ))}
                  <th colSpan={3} className="border-l border-[var(--border)]" />
                </tr>
              )}
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className={TH} style={{ width: 28 }}></th>
                <th className={`${TH} text-center`} style={{ width: 36 }}>#</th>
                <th className={TH}>Prezime</th>
                <th className={TH}>Ime</th>
                <th className={TH} style={{ width: 80 }}>Klub</th>
                <th className={`${TH} text-center`} style={{ width: 46 }}>NOC</th>
                {isMultiSeries && !isSportPistol &&
                  [0, 1, 2, 3, 4, 5].map((n) => (
                    <th
                      key={n}
                      className={`${TH} text-center`}
                      style={{
                        width: 54,
                        borderLeft: (n === 0 || (isThreePos && n % 2 === 0)) ? "1px solid var(--border)" : undefined,
                      }}
                    >
                      S{n + 1}
                    </th>
                  ))}
                {isSportPistol && SPW_GROUPS.map((g) => (
                  g.indices.map((sIdx, i) => (
                    <th
                      key={sIdx}
                      className={`${TH} text-center`}
                      style={{
                        width: 54,
                        borderLeft: i === 0 ? "1px solid var(--border)" : undefined,
                      }}
                    >
                      S{sIdx + 1}
                    </th>
                  ))
                ))}
                <th className={`${TH} text-right`} style={{ width: 72, borderLeft: (isSportPistol || isThreePos || isMultiSeries) ? "1px solid var(--border)" : undefined }}>Ukupno</th>
                <th className={`${TH} text-right`} style={{ width: 52 }}>Inn.</th>
                <th className={TH} style={{ width: 52 }}></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="group transition-colors hover:bg-[var(--surface)]"
                  style={{ opacity: row.skip ? 0.45 : 1 }}
                >
                  {/* Skip toggle */}
                  <td className={TD}>
                    <button
                      onClick={() => updateRow(idx, { skip: !row.skip })}
                      title={row.skip ? "Aktiviraj" : "Preskoči"}
                      className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-[var(--subtle)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
                    >
                      {row.skip ? (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M2 5h6M5 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M2 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </td>

                  {/* Auto rank */}
                  <td className={`${TD} text-center`}>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums font-bold text-[var(--muted)]">
                      {row.skip ? "—" : (row.qualRank ?? "—")}
                    </span>
                  </td>

                  {/* Last name */}
                  <td className={TD}>
                    <input
                      value={row.lastName}
                      onChange={(e) => updateRow(idx, { lastName: e.target.value })}
                      disabled={row.skip}
                      placeholder="Prezime"
                      className={INPUT_BORDERLESS}
                    />
                  </td>

                  {/* First name */}
                  <td className={TD}>
                    <input
                      value={row.firstName}
                      onChange={(e) => updateRow(idx, { firstName: e.target.value })}
                      disabled={row.skip}
                      placeholder="Ime"
                      className={INPUT_BORDERLESS}
                    />
                  </td>

                  {/* Club */}
                  <td className={TD}>
                    <input
                      value={row.clubAbbr ?? ""}
                      onChange={(e) => updateRow(idx, { clubAbbr: e.target.value })}
                      disabled={row.skip}
                      placeholder="SKP"
                      className={INPUT_BORDERLESS}
                    />
                  </td>

                  {/* NOC */}
                  <td className={`${TD} text-center`}>
                    <NocCellSelect
                      value={row.teamNoc}
                      onChange={(v) => updateRow(idx, { teamNoc: v })}
                      disabled={row.skip}
                    />
                  </td>

                  {/* Series S1–S6 */}
                  {isMultiSeries && !isSportPistol &&
                    (row.qualSeries ?? [0, 0, 0, 0, 0, 0]).map((val, sIdx) => (
                      <td
                        key={sIdx}
                        className={TD}
                        style={{
                          borderLeft: (sIdx === 0 || (isThreePos && sIdx % 2 === 0)) ? "1px solid var(--border)" : undefined,
                        }}
                      >
                        <input
                          type="number"
                          value={val || ""}
                          onChange={(e) =>
                            updateSeries(idx, sIdx, parseFloat(e.target.value) || 0)
                          }
                          disabled={row.skip}
                          placeholder={constraints.placeholder}
                          step={constraints.step}
                          min={0}
                          max={constraints.maxSeries}
                          className={`${INPUT_BOX} w-full text-center`}
                        />
                      </td>
                    ))}
                  {isSportPistol && SPW_GROUPS.map((g) => {
                    const series = row.qualSeries ?? [0, 0, 0, 0, 0, 0];
                    return g.indices.map((sIdx, i) => (
                      <td
                        key={sIdx}
                        className={TD}
                        style={{ borderLeft: i === 0 ? "1px solid var(--border)" : undefined }}
                      >
                        <input
                          type="number"
                          value={series[sIdx] || ""}
                          onChange={(e) =>
                            updateSeries(idx, sIdx, parseFloat(e.target.value) || 0)
                          }
                          disabled={row.skip}
                          placeholder={constraints.placeholder}
                          step={constraints.step}
                          min={0}
                          max={constraints.maxSeries}
                          className={`${INPUT_BOX} w-full text-center`}
                        />
                      </td>
                    ));
                  })}

                  {/* Total — auto if series entered, manual otherwise */}
                  <td className={`${TD} text-right`} style={{ borderLeft: isMultiSeries ? "1px solid var(--border)" : undefined }}>
                    {isMultiSeries && rowHasSeries(row) ? (
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)] pr-1">
                        {row.qualTotal ? row.qualTotal.toFixed(1) : "—"}
                      </span>
                    ) : (
                      <input
                        type="number"
                        value={row.qualTotal || ""}
                        onChange={(e) =>
                          updateRow(idx, { qualTotal: parseFloat(e.target.value) || 0 })
                        }
                        disabled={row.skip}
                        placeholder={constraints.placeholder}
                        step={constraints.step}
                        min={0}
                        max={constraints.maxTotal}
                        className={`${INPUT_BOX} text-right`}
                        style={{ width: "68px" }}
                      />
                    )}
                  </td>

                  {/* Inners */}
                  <td className={`${TD} text-right`}>
                    <input
                      type="number"
                      value={row.qualInners ?? ""}
                      onChange={(e) =>
                        updateRow(idx, { qualInners: parseInt(e.target.value) || null })
                      }
                      disabled={row.skip}
                      placeholder="—"
                      min={0}
                      className={`${INPUT_BOX} text-right`}
                      style={{ width: "42px" }}
                    />
                  </td>

                  {/* Row actions */}
                  <td className={TD}>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button
                        onClick={() => duplicateRow(idx)}
                        title="Dupliraj red"
                        className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => removeRow(idx)}
                        title="Obriši red"
                        disabled={rows.length === 1}
                        className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30"
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 3h8M5 3V2h2v1M5 9.5V5M7 9.5V5M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row footer */}
        <div className="border-t border-[var(--border)] px-3 py-2">
          <button
            onClick={addRow}
            className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors py-1 px-2 rounded hover:bg-[var(--surface)]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Dodaj strelca
          </button>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSubmit}
          disabled={loading || activeCount === 0 || !selectedComp}
          className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Unosim…" : `Sačuvaj ${activeCount} rezultata →`}
        </button>
        <button
          onClick={reset}
          className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
        >
          Resetuj
        </button>
        {!selectedComp && (
          <p className="text-xs text-[var(--subtle)]">Izaberi takmičenje pre slanja.</p>
        )}
      </div>
    </div>
  );
}
