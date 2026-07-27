"use client";

import { useState } from "react";
import type { CompetitionLevel } from "@/lib/pdf-import/types";
import { DonePanel } from "../_shared/DonePanel";
import { MixedTeamReviewTable, type MixedTeamEntry } from "../_shared/MixedTeamReviewTable";

type Step = "select" | "review" | "done";

type MixedEntry = MixedTeamEntry;

interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "world",         label: "Svetsko (ISSF)"  },
  { value: "continental",   label: "Kontinentalno"   },
  { value: "national",      label: "Državno"         },
  { value: "regional",      label: "Regionalno"      },
  { value: "club",          label: "Klubsko"         },
  { value: "olympic",       label: "Olimpijsko"      },
  { value: "international", label: "Međunarodno"     },
];

export function MixedTeamMode() {
  const [step, setStep]         = useState<Step>("select");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [issfCompId, setIssfCompId] = useState("");
  const [compName, setCompName]     = useState("");
  const [compDate, setCompDate]     = useState("");
  const [compLocation, setCompLocation] = useState("");
  const [compLevel, setCompLevel]   = useState<CompetitionLevel>("world");

  const [entries, setEntries]       = useState<MixedEntry[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [result, setResult]         = useState<CommitResult | null>(null);

  async function handleImport() {
    const id = parseInt(issfCompId.trim());
    if (isNaN(id)) { setError("Upiši ISSF competition ID (broj)"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/issf/import-mixed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setEntries(data.entries);
      setEventCount(data.eventCount);
      setImportErrors(data.errors ?? []);
      setStep("review");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    setLoading(true); setError(null);

    // Group by discipline and call commit-mixed for each
    const byDisc = new Map<string, MixedEntry[]>();
    for (const e of entries) {
      if (!byDisc.has(e.disciplineCode)) byDisc.set(e.disciplineCode, []);
      byDisc.get(e.disciplineCode)!.push(e);
    }

    let totalInserted = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    let competitionId: number | null = null;

    // First commit: create competition
    let firstCompId: number | null = null;

    for (const [disc, discEntries] of byDisc) {
      try {
        const res: Response = await fetch("/api/admin/import/commit-mixed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitionId: firstCompId,
            competition: firstCompId ? undefined : {
              name: compName || `ISSF Mixed Team ${issfCompId}`,
              date: compDate || new Date().toISOString().split("T")[0],
              location: compLocation || "",
              level: compLevel,
            },
            discipline: disc,
            isFinals: false,
            entries: discEntries.map((e) => ({
              skip: e.skip,
              nocCode: e.nocCode,
              teamNumber: e.teamNumber,
              qualRank: e.qualRank,
              qualTotal: e.qualTotal,
              qualified: e.qualified,
              m_lastName: e.mLastName,
              m_firstName: e.mFirstName,
              m_series: e.m_series,
              mInners: e.mInners,
              mTotal: e.mTotal,
              f_lastName: e.fLastName,
              f_firstName: e.fFirstName,
              f_series: e.f_series,
              fInners: e.fInners,
              fTotal: e.fTotal,
            })),
          }),
        });
        const data = await res.json() as { inserted?: number; skipped?: number; errors?: string[]; competitionId?: number; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Commit error");
        totalInserted += data.inserted ?? 0;
        totalSkipped += data.skipped ?? 0;
        allErrors.push(...(data.errors ?? []));
        if (!firstCompId && data.competitionId) firstCompId = data.competitionId;

        // Merge finals if any
        const finalists = discEntries.filter((e) => !e.skip && e.finalRank != null);
        if (finalists.length > 0 && firstCompId) {
          const fRes = await fetch("/api/admin/import/commit-mixed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              competitionId: firstCompId,
              discipline: disc,
              isFinals: true,
              entries: finalists.map((e) => ({
                nocCode: e.nocCode,
                teamNumber: e.teamNumber,
                finalRank: e.finalRank,
                finalTotal: e.finalTotal,
              })),
            }),
          });
          const fData = await fRes.json();
          allErrors.push(...(fData.errors ?? []));
        }
      } catch (err) {
        allErrors.push(`${disc}: ${String(err)}`);
      }
    }

    competitionId = firstCompId;
    setResult({ inserted: totalInserted, skipped: totalSkipped, errors: allErrors, competitionId: competitionId ?? 0 });
    setStep("done");
    setLoading(false);
  }

  function toggleSkip(idx: number) {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, skip: !e.skip } : e));
  }

  function reset() {
    setStep("select"); setEntries([]); setResult(null);
    setError(null); setImportErrors([]);
  }

  const active = entries.filter((e) => !e.skip);

  if (step === "done" && result) {
    return <DonePanel result={result} onReset={reset} resetLabel="Uvezi još jedno takmičenje" />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === "select" && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">ISSF Competition ID</label>
            <input
              value={issfCompId}
              onChange={(e) => setIssfCompId(e.target.value)}
              placeholder="npr. 3574"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--subtle)]">Broj iz ISSF URL-a: api.issf-sports.org/api/v01/competitions/<strong>3574</strong>/results</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Naziv takmičenja</label>
              <input
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="npr. ISSF World Cup Hangzhou 2026"
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Datum</label>
              <input type="date" value={compDate} onChange={(e) => setCompDate(e.target.value)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Lokacija</label>
              <input value={compLocation} onChange={(e) => setCompLocation(e.target.value)} placeholder="npr. Hangzhou, Kina" className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Nivo</label>
              <select value={compLevel} onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]">
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={loading || !issfCompId.trim()}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Preuzimam rezultate…" : "Uvezi mešovite timove →"}
          </button>
        </div>
      )}

      {step === "review" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span><span className="font-semibold text-[var(--ink)]">{eventCount}</span> {eventCount === 1 ? "disciplina" : "discipline"}</span>
              <span><span className="font-semibold text-[var(--ink)]">{active.length}</span> za unos</span>
              <span><span className="font-semibold text-[var(--ink)]">{entries.filter(e => e.skip).length}</span> preskočeno</span>
            </div>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">← Nazad</button>
          </div>

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Upozorenja:</p>
              {importErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <MixedTeamReviewTable entries={entries} onToggleSkip={toggleSkip} />

          <div className="flex gap-3">
            <button
              onClick={handleCommit}
              disabled={loading || active.length === 0}
              className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Unosim…" : `Potvrdi i unesi ${active.length} tima →`}
            </button>
            <button onClick={reset} className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">Otkaži</button>
          </div>
        </>
      )}
    </div>
  );
}
