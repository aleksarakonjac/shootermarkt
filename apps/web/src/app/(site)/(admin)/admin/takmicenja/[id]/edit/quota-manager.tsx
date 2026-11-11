"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuotaData } from "@/app/api/admin/competitions/[id]/quotas/route";
import { MAX_QUOTAS_PER_NOC, type QuotaBasis } from "@/lib/quota-assign";

const btn = "rounded-md border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50";
const field = "rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--ink)]";
const BASIS_LABEL: Record<QuotaBasis, string> = { final: "po finalu", qualification: "po kvalifikacijama" };

/**
 * Olimpijske kvote (LA 2028) jednog takmičenja: prvo se podesi koliko kvota koja disciplina deli i po kom plasmanu
 * (finale ili kvalifikacije), pa se kvote dodele automatski ili kvačicama. Pravila sprovodi API.
 */
export function QuotaManager({ competitionId }: { competitionId: number }) {
  const url = `/api/admin/competitions/${competitionId}/quotas`;
  const [data, setData] = useState<QuotaData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newPlaces, setNewPlaces] = useState(3);
  const [newBasis, setNewBasis] = useState<QuotaBasis>("final");

  const load = useCallback(async () => {
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Greška");
      setData(json);
    } catch (e) {
      setError(String(e));
    }
  }, [url]);

  useEffect(() => { void load(); }, [load]);

  async function send(method: "POST" | "PUT" | "DELETE" | "PATCH", body: object = {}) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Greška");
      if (method === "PATCH") setNotice(json.assigned ? `Dodeljeno kvota: ${json.assigned}` : "Nema šta da se dodeli");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-[var(--border)] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Olimpijske kvote · LA 2028</h2>
      <p className="text-xs text-[var(--muted)] mb-4">
        Podesi koliko kvota koja disciplina deli i po kom plasmanu (iz ISSF dokumenta). Strelac može osvojiti jednu kvotu. Država može imati jednu po disciplini na svetskom prvenstvu, a do dve na ostalim takmičenjima, i najviše {MAX_QUOTAS_PER_NOC} po disciplini ukupno. Rezultat kvalifikacija mora biti jednak MQS-u ili veći.
      </p>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)]">{notice}</div>}
      {data === null && !error && <p className="text-sm text-[var(--muted)]">Učitavam…</p>}
      {data && data.disciplines.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => send("PATCH")} className={btn}>Dodeli automatski</button>
          <span className="text-xs text-[var(--muted)]">Pokreni kad je rangiranje gotovo. Dodeljeno možeš ručno da menjaš.</span>
        </div>
      )}
      {data?.disciplines.length === 0 && <p className="mb-3 text-sm text-[var(--muted)]">Ovo takmičenje još ne deli kvote.</p>}

      <div className="space-y-3">
        {data?.disciplines.map((d) => {
          const used = d.candidates.filter((f) => f.quota).length;
          return (
            <div key={d.disciplineId} className="rounded-lg border border-[var(--border)]">
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[var(--surface-2)] rounded-t-lg">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  {d.code} <span className="font-normal text-[var(--muted)]">· {d.name}</span>
                  <span className="ml-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{used}/{d.places}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={d.basis} disabled={busy} aria-label="Osnova deobe"
                    onChange={(e) => send("PUT", { disciplineId: d.disciplineId, places: d.places, basis: e.target.value })}
                    className={field}
                  >
                    {(Object.keys(BASIS_LABEL) as QuotaBasis[]).map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    Mesta
                    <input
                      type="number" min={1} max={20} defaultValue={d.places} disabled={busy}
                      onBlur={(e) => { const places = Number(e.target.value); if (places !== d.places) void send("PUT", { disciplineId: d.disciplineId, places }); }}
                      className={`w-14 ${field}`}
                    />
                  </label>
                  <button type="button" disabled={busy} onClick={() => send("DELETE", { disciplineId: d.disciplineId })} className={`${btn} !text-red-600 !border-red-300`}>Ukloni</button>
                </div>
              </div>
              {d.nocCounts.length > 0 && (
                <p className="px-3 py-1.5 text-xs text-[var(--muted)] border-b border-[var(--border)]">
                  Kvote po državama:{" "}
                  {d.nocCounts.map((n, i) => (
                    <span key={n.noc} className={n.count >= MAX_QUOTAS_PER_NOC ? "font-semibold text-[var(--ink)]" : undefined}>{i > 0 && " · "}{n.noc} {n.count}</span>
                  ))}
                </p>
              )}
              {d.candidates.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[var(--muted)]">Još nema rezultata sa plasmanom {BASIS_LABEL[d.basis]}.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {d.candidates.map((f) => (
                    <li key={f.resultId}>
                      <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--surface)]">
                        <input
                          type="checkbox" className="h-4 w-4"
                          checked={f.quota}
                          disabled={busy || (!f.quota && (used >= d.places || f.belowMqs))}
                          onChange={(e) => send("POST", { resultId: f.resultId, quota: e.target.checked })}
                        />
                        <span className="w-8 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)]">{f.rank == null ? "—" : f.fromQualification ? `Q${f.rank}` : f.rank}</span>
                        <span className="text-[var(--ink)]">{f.lastName} {f.firstName}</span>
                        {f.nationality && <span className="text-xs text-[var(--muted)]">{f.nationality}</span>}
                        {f.qualTotal != null && <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{f.qualTotal}</span>}
                        {f.belowMqs && <span className={`${f.qualTotal == null ? "ml-auto " : ""}text-xs font-semibold text-red-600`}>ispod MQS</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {data && data.available.length > 0 && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newDiscipline) void send("PUT", { disciplineId: Number(newDiscipline), places: newPlaces, basis: newBasis }).then(() => setNewDiscipline(""));
          }}
        >
          <select value={newDiscipline} onChange={(e) => setNewDiscipline(e.target.value)} className={`py-1.5 ${field}`} aria-label="Disciplina">
            <option value="">Dodaj disciplinu…</option>
            {data.available.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
          </select>
          <select value={newBasis} onChange={(e) => setNewBasis(e.target.value as QuotaBasis)} className={`py-1.5 ${field}`} aria-label="Osnova deobe">
            {(Object.keys(BASIS_LABEL) as QuotaBasis[]).map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            Mesta
            <input type="number" min={1} max={20} value={newPlaces} onChange={(e) => setNewPlaces(Number(e.target.value))} className={`w-14 ${field}`} />
          </label>
          <button type="submit" disabled={busy || !newDiscipline} className={btn}>Dodaj</button>
        </form>
      )}
    </div>
  );
}
