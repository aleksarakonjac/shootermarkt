"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { IssfCandidate } from "@shootermarkt/adapters/issf/sync";
import type { ResolveAction, ResolveResult } from "@/app/api/admin/shooters/resolve/route";

export type UnlinkedRow = {
  id: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  gender: string | null;
  birthYear: number | null;
  reviewed: boolean;
  verified: boolean;
  clubId: number | null;
  resultCount: number;
  lastDate: string | null;
};

/** link:<issfId> | merge:<shooterId> | dismiss | skip | manual */
type Choice = string;
type RowState = {
  candidates?: IssfCandidate[];
  loading?: boolean;
  error?: string;
  choice: Choice;
  manual: string;
  safe: boolean;
  status?: { ok: boolean; message: string };
};

const LOOKUP_CONCURRENCY = 3;
const APPLY_BATCH = 25;

const cell = "px-3 py-2.5 align-top";
const selectCls = "w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]";
const btn = "rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-40";

const MATCH_LABEL = { exact: "tačno", close: "blisko", weak: "slabo" } as const;

/**
 * Preporuka: jedan tačan kandidat, ista nacija i godište se ne sukobljavaju.
 * ISSF ne vrati nikoga → "ostavi bez ISSF ID", da se red skloni sa liste.
 */
function suggest(row: UnlinkedRow, candidates: IssfCandidate[]): { choice: Choice; safe: boolean } {
  if (candidates.length === 0) return { choice: "dismiss", safe: true };
  const good = candidates.filter((c) => c.match !== "weak");
  const exact = good.filter((c) => c.match === "exact");
  const top = exact.length === 1 ? exact[0] : exact.length === 0 && good.length === 1 ? good[0] : null;
  if (!top) return { choice: "skip", safe: false };
  const choice = top.existingShooterId && top.existingShooterId !== row.id ? `merge:${top.existingShooterId}` : `link:${top.issfId}`;
  const safe =
    top.match === "exact" &&
    (!row.nationality || top.nationCode === row.nationality) &&
    (!row.birthYear || !top.birthYear || top.birthYear === row.birthYear);
  return { choice, safe };
}

function toAction(rowId: number, st: RowState): ResolveAction | null {
  let c = st.choice;
  if (c === "manual") {
    const m = st.manual.trim().replace(/^#/, "");
    c = /^\d+$/.test(m) ? `merge:${m}` : m ? `link:${m}` : "skip";
  }
  if (c === "dismiss") return { shooterId: rowId, kind: "dismiss" };
  if (c.startsWith("link:")) return { shooterId: rowId, kind: "link", issfId: c.slice(5) };
  if (c.startsWith("merge:")) return { shooterId: rowId, kind: "merge", keepId: Number(c.slice(6)) };
  return null;
}

export function UnlinkedClient({ rows, clubs }: { rows: UnlinkedRow[]; clubs: { id: number; name: string }[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<number, RowState>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { choice: "skip", manual: "", safe: false }]))
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const patch = (id: number, p: Partial<RowState>) => setState((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));

  async function lookup(row: UnlinkedRow) {
    patch(row.id, { loading: true, error: undefined });
    try {
      const qs = new URLSearchParams({ first: row.firstName, last: row.lastName, ...(row.nationality ? { noc: row.nationality } : {}) });
      const res = await fetch(`/api/admin/issf/athletes/lookup?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Greška ${res.status}`);
      const candidates = json as IssfCandidate[];
      const s = suggest(row, candidates);
      patch(row.id, { loading: false, candidates, choice: s.choice, safe: s.safe });
      if (s.safe) setSelected((prev) => new Set(prev).add(row.id));
    } catch (e) {
      patch(row.id, { loading: false, error: e instanceof Error ? e.message : "Greška" });
    }
  }

  async function lookupAll() {
    const todo = rows.filter((r) => !state[r.id]?.candidates && !state[r.id]?.status?.ok);
    cancelRef.current = false;
    setProgress({ done: 0, total: todo.length });
    let next = 0, done = 0;
    await Promise.all(Array.from({ length: LOOKUP_CONCURRENCY }, async () => {
      while (!cancelRef.current && next < todo.length) {
        await lookup(todo[next++]);
        setProgress({ done: ++done, total: todo.length });
      }
    }));
    setProgress(null);
  }

  async function apply() {
    const picked = rows.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, action: toAction(r.id, state[r.id]) })).filter((x): x is { id: number; action: ResolveAction } => !!x.action);
    if (picked.length === 0) { setMessage("Nema izabranih redova sa odlukom."); return; }
    const merges = picked.filter((p) => p.action.kind === "merge").length;
    if (!confirm(`Primeni ${picked.length} odluka (spajanja: ${merges})? Spajanje briše duplikat i ne može se poništiti.`)) return;
    setApplying(true);
    setMessage(null);
    let ok = 0;
    try {
      for (let i = 0; i < picked.length; i += APPLY_BATCH) {
        const batch = picked.slice(i, i + APPLY_BATCH);
        const res = await fetch("/api/admin/shooters/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions: batch.map((b) => b.action) }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setMessage(json.error ?? `Greška ${res.status}`); break; }
        for (const r of json.results as ResolveResult[]) {
          patch(r.shooterId, { status: { ok: r.ok, message: r.message } });
          if (r.ok) { ok++; setSelected((prev) => { const n = new Set(prev); n.delete(r.shooterId); return n; }); }
        }
      }
      setMessage(`Primenjeno ${ok} od ${picked.length}.`);
      router.refresh();
    } finally {
      setApplying(false);
    }
  }

  const toggle = (id: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const safeIds = rows.filter((r) => state[r.id]?.safe && !state[r.id]?.status?.ok).map((r) => r.id);
  const selectedCount = rows.filter((r) => selected.has(r.id) && toAction(r.id, state[r.id])).length;

  if (rows.length === 0) {
    return <div className="rounded-xl border border-[var(--border)] py-16 text-center text-sm text-[var(--muted)]">Nema nepovezanih strelaca za ovaj filter.</div>;
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={lookupAll} disabled={!!progress || applying}>
          {progress ? `Pretražujem ISSF… ${progress.done}/${progress.total}` : "Pretraži ISSF za sve"}
        </button>
        {progress && <button type="button" className={btn} onClick={() => { cancelRef.current = true; }}>Prekini</button>}
        <button type="button" className={btn} disabled={safeIds.length === 0} onClick={() => setSelected(new Set(safeIds))}>
          Izaberi sigurne ({safeIds.length})
        </button>
        <button type="button" className={btn} disabled={selected.size === 0} onClick={() => setSelected(new Set())}>Poništi izbor</button>
        <span className="text-xs text-[var(--subtle)]">„Sigurno“ = jedan tačan ISSF pogodak, ista nacija, bez sukoba godišta.</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[1300px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <th className="w-10 px-3 py-2.5" />
              <th className="px-3 py-2.5">Strelac</th>
              <th className="w-48 px-3 py-2.5">ISSF kandidati</th>
              <th className="w-72 px-3 py-2.5">Odluka</th>
              <th className="w-80 px-3 py-2.5">Profil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => {
              const st = state[r.id];
              const done = st.status?.ok;
              return (
                <tr key={r.id} className={done ? "opacity-50" : ""}>
                  <td className={cell}>
                    <input type="checkbox" aria-label={`Izaberi ${r.lastName} ${r.firstName}`} checked={selected.has(r.id)} disabled={done || applying} onChange={() => toggle(r.id)} />
                  </td>
                  <td className={cell}>
                    <a href={`/admin/strelci/${r.id}`} target="_blank" rel="noreferrer" className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)]">
                      {r.lastName} {r.firstName}
                    </a>
                    <div className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.7rem] text-[var(--subtle)]">
                      #{r.id} · {r.nationality ?? "—"}{r.gender ? ` · ${r.gender}` : ""}{r.birthYear ? ` · ${r.birthYear}` : ""} · {r.resultCount} rez.{r.lastDate ? ` · ${r.lastDate}` : ""}{r.reviewed ? " · pregledan" : ""}
                    </div>
                    {st.status && <div className="mt-1 text-xs font-medium" style={{ color: st.status.ok ? "var(--success)" : "var(--brand-primary)" }}>{st.status.message}</div>}
                  </td>
                  <td className={cell}>
                    {st.loading ? <span className="text-xs text-[var(--muted)]">traži…</span>
                      : st.error ? <span className="text-xs text-[var(--brand-primary)]">{st.error}</span>
                      : st.candidates ? <span className="text-xs text-[var(--muted)]">{st.candidates.length ? `${st.candidates.length} kandidata` : "nema u ISSF"}</span>
                      : <button type="button" className="text-xs font-semibold text-[var(--brand-primary)]" onClick={() => lookup(r)}>Pretraži</button>}
                  </td>
                  <td className={cell}>
                    <select
                      aria-label={`Odluka: ${r.lastName} ${r.firstName}`}
                      value={st.choice}
                      disabled={done || applying}
                      onChange={(e) => { patch(r.id, { choice: e.target.value }); if (e.target.value !== "skip") setSelected((prev) => new Set(prev).add(r.id)); }}
                      className={selectCls}
                    >
                      <option value="skip">— preskoči —</option>
                      {(st.candidates ?? []).map((c) => {
                        const label = `${c.lastName} ${c.firstName} · ${c.nationCode}${c.birthYear ? ` · ${c.birthYear}` : ""} · ${MATCH_LABEL[c.match]}`;
                        return c.existingShooterId && c.existingShooterId !== r.id
                          ? <option key={c.issfId} value={`merge:${c.existingShooterId}`}>Spoji u #{c.existingShooterId}: {label}</option>
                          : <option key={c.issfId} value={`link:${c.issfId}`}>Poveži: {label}</option>;
                      })}
                      <option value="manual">Ručno (ISSF ID ili #id strelca)…</option>
                      <option value="dismiss">Nema ISSF profil — ostavi</option>
                    </select>
                    {st.choice === "manual" && (
                      <input
                        value={st.manual}
                        onChange={(e) => patch(r.id, { manual: e.target.value })}
                        placeholder="SHSRBM… ili #123"
                        className={`${selectCls} mt-1`}
                      />
                    )}
                  </td>
                  <td className={cell}><ProfileCell row={r} clubs={clubs} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 shadow-lg">
        <span className="text-sm text-[var(--muted)]">Izabrano sa odlukom: {selectedCount}</span>
        {message && <span role="status" className="text-sm font-medium text-[var(--ink)]">{message}</span>}
        <button
          type="button"
          onClick={apply}
          disabled={selectedCount === 0 || applying}
          className="ml-auto rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-40"
        >
          {applying ? "Primenjujem…" : "Primeni izabrane"}
        </button>
      </div>
    </>
  );
}

/** Klub / pol / godište + verifikacija; piše samo ta polja (PATCH /quick), nezavisno od ISSF odluke. */
function ProfileCell({ row, clubs }: { row: UnlinkedRow; clubs: { id: number; name: string }[] }) {
  const [clubId, setClubId] = useState(row.clubId ? String(row.clubId) : "");
  const [gender, setGender] = useState(row.gender ?? "");
  const [birthYear, setBirthYear] = useState(row.birthYear ? String(row.birthYear) : "");
  const [verified, setVerified] = useState(row.verified);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(verify: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/shooters/${row.id}/quick`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: clubId ? Number(clubId) : null, gender: gender || null, birthYear: birthYear ? Number(birthYear) : null, ...(verify ? { verified: true } : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(json.error ?? "Greška");
      if (verify) setVerified(true);
      setMsg(verify ? "Verifikovan" : "Sačuvano");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <select aria-label="Klub" className={selectCls} value={clubId} onChange={(e) => setClubId(e.target.value)}>
        <option value="">— klub —</option>
        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex gap-1.5">
        <select aria-label="Pol" className={selectCls} value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">— pol —</option>
          <option value="M">Muški</option>
          <option value="F">Ženski</option>
        </select>
        <input aria-label="Godište" className={selectCls} value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="godište" />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy} onClick={() => save(false)} className="text-xs font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] disabled:opacity-40">Sačuvaj</button>
        {verified
          ? <span className="text-xs text-[var(--muted)]">verifikovan ✓</span>
          : <button type="button" disabled={busy} onClick={() => save(true)} className="rounded bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-40">Verifikuj</button>}
        {msg && <span role="status" className="text-xs text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  );
}
