"use client";

import { useCallback, useEffect, useState } from "react";
import type { ManualAllocation, ManualQuotaData } from "@/app/api/admin/olympic-quotas/route";

type Kind = ManualAllocation["kind"];
const KINDS: Array<{ kind: Kind; label: string; hint: string }> = [
  { kind: "ranking", label: "Olimpijska rang-lista", hint: "Dodeljuje se po rang-listi koja se zaključuje 1. maja 2028." },
  { kind: "host", label: "Domaćin", hint: "Mesta domaćina igara." },
  { kind: "universality", label: "Univerzalna mesta", hint: "Mesta za univerzalnost." },
];

const btn = "rounded-md border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50";
const field = "rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--ink)]";

type Found = { id: number; firstName: string; lastName: string; nationality: string | null };

export function OtherQuotasManager() {
  const [data, setData] = useState<ManualQuotaData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [add, setAdd] = useState<Record<Kind, { disciplineId: string; places: number }>>({
    ranking: { disciplineId: "", places: 1 },
    host: { disciplineId: "", places: 1 },
    universality: { disciplineId: "", places: 1 },
  });
  const [searchFor, setSearchFor] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/olympic-quotas");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Greška");
      setData(json);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (searchFor == null || query.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/shooters?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setFound((await res.json()).slice(0, 8));
    }, 250);
    return () => clearTimeout(t);
  }, [query, searchFor]);

  async function send(method: "POST" | "PUT" | "DELETE", body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/olympic-quotas", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Greška");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (data === null) return <p className="text-sm text-[var(--muted)]">{error ?? "Učitavam…"}</p>;

  return (
    <div className="space-y-8">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {KINDS.map(({ kind, label, hint }) => {
        const rows = data.allocations.filter((a) => a.kind === kind);
        const used = new Set(rows.map((r) => r.disciplineId));
        const free = data.disciplines.filter((d) => !used.has(d.id));
        const total = rows.reduce((n, r) => n + r.places, 0);
        return (
          <section key={kind} className="rounded-xl border border-[var(--border)] p-5">
            <h2 className="mb-1 flex items-baseline gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              {label} <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm normal-case tracking-normal text-[var(--ink)]">{total} mesta</span>
            </h2>
            <p className="mb-4 text-xs text-[var(--muted)]">{hint}</p>

            <div className="space-y-3">
              {rows.map((a) => (
                <div key={a.id} className="rounded-lg border border-[var(--border)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-lg bg-[var(--surface-2)] px-3 py-2">
                    <div className="text-sm font-semibold text-[var(--ink)]">
                      {a.code} <span className="font-normal text-[var(--muted)]">· {a.name}</span>
                      <span className="ml-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{a.holders.length}/{a.places}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        Mesta
                        <input type="number" min={1} max={50} defaultValue={a.places} disabled={busy}
                          onBlur={(e) => { const places = Number(e.target.value); if (places !== a.places) void send("PUT", { kind, disciplineId: a.disciplineId, places }); }}
                          className={`w-16 ${field}`} />
                      </label>
                      <button type="button" disabled={busy} onClick={() => send("DELETE", { kind, disciplineId: a.disciplineId })} className={`${btn} !text-red-600 !border-red-300`}>Ukloni</button>
                    </div>
                  </div>

                  <ul className="divide-y divide-[var(--border)]">
                    {a.holders.map((h) => (
                      <li key={h.quotaId} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="text-[var(--ink)]">{h.lastName} {h.firstName}</span>
                        {h.nationality && <span className="text-xs text-[var(--muted)]">{h.nationality}</span>}
                        <button type="button" disabled={busy} onClick={() => send("POST", { allocationId: a.id, shooterId: h.shooterId, quota: false })} className="ml-auto text-xs font-semibold text-red-600 hover:underline">Ukloni</button>
                      </li>
                    ))}
                    {a.holders.length < a.places && (
                      <li className="px-3 py-2">
                        {searchFor === a.id ? (
                          <div>
                            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ime ili prezime strelca…" className={`w-full max-w-sm ${field}`} />
                            {found.length > 0 && (
                              <ul className="mt-1 max-w-sm divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-[var(--bg)]">
                                {found.map((s) => (
                                  <li key={s.id}>
                                    <button type="button" disabled={busy} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-[var(--surface)]"
                                      onClick={async () => { await send("POST", { allocationId: a.id, shooterId: s.id, quota: true }); setSearchFor(null); setQuery(""); }}>
                                      {s.lastName} {s.firstName}
                                      {s.nationality && <span className="text-xs text-[var(--muted)]">{s.nationality}</span>}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setSearchFor(a.id); setQuery(""); }} className={btn}>Dodaj strelca</button>
                        )}
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            {free.length > 0 && (
              <form className="mt-4 flex flex-wrap items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); const f = add[kind]; if (f.disciplineId) void send("PUT", { kind, disciplineId: Number(f.disciplineId), places: f.places }).then(() => setAdd((s) => ({ ...s, [kind]: { disciplineId: "", places: 1 } }))); }}>
                <select value={add[kind].disciplineId} onChange={(e) => setAdd((s) => ({ ...s, [kind]: { ...s[kind], disciplineId: e.target.value } }))} className={`py-1.5 ${field}`} aria-label="Disciplina">
                  <option value="">Dodaj disciplinu…</option>
                  {free.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Mesta
                  <input type="number" min={1} max={50} value={add[kind].places} onChange={(e) => setAdd((s) => ({ ...s, [kind]: { ...s[kind], places: Number(e.target.value) } }))} className={`w-16 ${field}`} />
                </label>
                <button type="submit" disabled={busy || !add[kind].disciplineId} className={btn}>Dodaj</button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
