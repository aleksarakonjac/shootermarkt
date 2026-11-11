"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuotaData } from "@/app/api/admin/competitions/[id]/quotas/route";

const btn = "rounded-md border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50";

/**
 * Olimpijske kvote (LA 2028) jednog takmičenja: prvo se podesi koliko kvota koja disciplina deli,
 * pa se označe finalisti koji su ih osvojili. Označiti se ne može više strelaca nego što ima mesta.
 */
export function QuotaManager({ competitionId }: { competitionId: number }) {
  const url = `/api/admin/competitions/${competitionId}/quotas`;
  const [data, setData] = useState<QuotaData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newPlaces, setNewPlaces] = useState(3);

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

  async function send(method: "POST" | "PUT" | "DELETE", body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Greška");
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
        Podesi koliko kvota koja disciplina deli (iz ISSF dokumenta), pa označi finaliste koji su ih osvojili. Kvota pripada NOC-u; oznaka se prikazuje pored strelca u finalu.
      </p>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data === null && !error && <p className="text-sm text-[var(--muted)]">Učitavam…</p>}
      {data?.disciplines.length === 0 && <p className="mb-3 text-sm text-[var(--muted)]">Ovo takmičenje još ne deli kvote.</p>}

      <div className="space-y-3">
        {data?.disciplines.map((d) => {
          const used = d.finalists.filter((f) => f.quota).length;
          return (
            <div key={d.disciplineId} className="rounded-lg border border-[var(--border)]">
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[var(--surface-2)] rounded-t-lg">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  {d.code} <span className="font-normal text-[var(--muted)]">· {d.name}</span>
                  <span className="ml-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{used}/{d.places}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    Mesta
                    <input
                      type="number" min={1} max={20} defaultValue={d.places} disabled={busy}
                      onBlur={(e) => { const places = Number(e.target.value); if (places !== d.places) void send("PUT", { disciplineId: d.disciplineId, places }); }}
                      className="w-14 rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--ink)]"
                    />
                  </label>
                  <button type="button" disabled={busy} onClick={() => send("DELETE", { disciplineId: d.disciplineId })} className={`${btn} !text-red-600 !border-red-300`}>Ukloni</button>
                </div>
              </div>
              {d.finalists.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[var(--muted)]">Još nema finalista.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {d.finalists.map((f) => (
                    <li key={f.resultId}>
                      <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--surface)]">
                        <input
                          type="checkbox" className="h-4 w-4"
                          checked={f.quota}
                          disabled={busy || (!f.quota && used >= d.places)}
                          onChange={(e) => send("POST", { resultId: f.resultId, quota: e.target.checked })}
                        />
                        <span className="w-6 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)]">{f.finalRank ?? "—"}</span>
                        <span className="text-[var(--ink)]">{f.lastName} {f.firstName}</span>
                        {f.nationality && <span className="text-xs text-[var(--muted)]">{f.nationality}</span>}
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
            if (newDiscipline) void send("PUT", { disciplineId: Number(newDiscipline), places: newPlaces }).then(() => setNewDiscipline(""));
          }}
        >
          <select value={newDiscipline} onChange={(e) => setNewDiscipline(e.target.value)} className="rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--ink)]" aria-label="Disciplina">
            <option value="">Dodaj disciplinu…</option>
            {data.available.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            Mesta
            <input type="number" min={1} max={20} value={newPlaces} onChange={(e) => setNewPlaces(Number(e.target.value))} className="w-14 rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--ink)]" />
          </label>
          <button type="submit" disabled={busy || !newDiscipline} className={btn}>Dodaj</button>
        </form>
      )}
    </div>
  );
}
