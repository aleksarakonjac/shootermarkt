"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FocusPlan, FocusPlanItem } from "@/lib/focus-plan";
import type { Scope } from "@/lib/scope";

const AUTO_LIMIT = 3; // koliko takmičenja automatika prikazuje na početnoj
type SearchHit = { id: number; name: string; nameSr: string | null; date: string; dateEnd: string | null; level: string };

const fmtDate = (d: string, e: string | null) => {
  const f = (x: string) => x.split("-").reverse().join(".");
  return e && e !== d ? `${f(d)} – ${f(e)}` : f(d);
};

const btn = "px-2 py-1 rounded-md text-xs font-semibold border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-30";

export function FocusAdminClient({ scope, plan }: { scope: Scope; plan: FocusPlan }) {
  const router = useRouter();
  const [order, setOrder] = useState<FocusPlanItem[]>(plan.order);
  const [pinCount, setPinCount] = useState(plan.pinCount);
  const [hidden, setHidden] = useState<FocusPlanItem[]>(plan.hidden);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  const onSite = Math.max(AUTO_LIMIT, pinCount); // koliko ih početna stvarno prikazuje
  const touch = () => { setDirty(true); setError(null); };

  // Pinovi su uvek prefiks liste: svaka ručna izmena zakači i sve iznad izmenjene stavke.
  const pinThrough = (idx: number) => setPinCount((p) => Math.max(p, idx + 1));
  const markPinned = (list: FocusPlanItem[], through: number) => list.map((it, i) => (i <= through ? { ...it, pinned: true } : it));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    const through = Math.max(i, j);
    setOrder(markPinned(next, through));
    pinThrough(through);
    touch();
  }

  function toggleCollapsed(i: number) {
    const next = order.map((it, idx) => (idx === i ? { ...it, collapsed: !it.collapsed } : it));
    setOrder(markPinned(next, i));
    pinThrough(i);
    touch();
  }

  function remove(i: number) {
    const [item] = order.slice(i, i + 1);
    setOrder(order.filter((_, idx) => idx !== i));
    if (i < pinCount) setPinCount(pinCount - 1);
    setHidden([...hidden, { ...item, pinned: false, collapsed: false }]);
    touch();
  }

  function unhide(item: FocusPlanItem) {
    setHidden(hidden.filter((h) => h.id !== item.id));
    // Nazad u automatski deo liste (posle pinova); tačan auto-položaj određuje server pri sledećem učitavanju.
    const next = [...order];
    next.splice(pinCount, 0, { ...item, pinned: false });
    setOrder(next);
    touch();
  }

  function add(hit: SearchHit) {
    if (order.some((o) => o.id === hit.id) || hidden.some((h) => h.id === hit.id)) return;
    const item: FocusPlanItem = { id: hit.id, name: hit.nameSr ?? hit.name, date: hit.date, dateEnd: hit.dateEnd, level: hit.level, priority: 0, manualPriority: false, isLive: false, pinned: true, collapsed: false };
    const next = [...order];
    next.splice(pinCount, 0, item);
    setOrder(next);
    setPinCount(pinCount + 1);
    setQuery(""); setHits([]);
    touch();
  }

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setHits([]); return; }
    const res = await fetch(`/api/admin/focus?q=${encodeURIComponent(q.trim())}`);
    if (res.ok) setHits(await res.json());
  }

  async function put(items: Array<{ competitionId: number; position: number | null; hidden: boolean; collapsed: boolean }>) {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/focus", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, items }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška pri čuvanju");
      setDirty(false);
      router.refresh();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }

  const save = () => put([
    ...order.slice(0, pinCount).map((it, i) => ({ competitionId: it.id, position: i, hidden: false, collapsed: it.collapsed })),
    ...hidden.map((it) => ({ competitionId: it.id, position: null, hidden: true, collapsed: false })),
  ]);

  const visible = order.slice(0, onSite + 4);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
        <ol className="divide-y divide-[var(--border)]">
          {visible.map((it, i) => {
            const isOnSite = i < onSite;
            return (
              <li key={it.id}>
                {i === onSite && (
                  <div className="px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface-2)]">
                    Ispod ove linije nije na početnoj — sledeći u automatskom redu
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ opacity: isOnSite ? 1 : 0.6 }}>
                  <span className="w-5 shrink-0 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {it.name}
                      {it.isLive && <span className="ml-2 rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase text-white">u toku</span>}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {fmtDate(it.date, it.dateEnd)} · {it.level}
                      {it.priority > 0 || it.manualPriority ? ` · prioritet ${it.priority}${it.manualPriority ? " (ručni)" : ""}` : ""}
                    </p>
                  </div>
                  <span className="rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide" style={it.pinned || i < pinCount ? { background: "var(--brand-primary)", color: "white" } : { background: "var(--surface-2)", color: "var(--muted)" }}>
                    {i < pinCount ? "ručno" : "auto"}
                  </span>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--ink)]">
                    <input type="checkbox" checked={it.collapsed} onChange={() => toggleCollapsed(i)} /> sažeto
                  </label>
                  <div className="flex gap-1">
                    <button className={btn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Pomeri gore">↑</button>
                    <button className={btn} onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Pomeri dole">↓</button>
                    <button className={btn} onClick={() => remove(i)}>Sakrij</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {visible.length === 0 && <p className="px-4 py-6 text-sm text-[var(--muted)]">Nema takmičenja za ovaj scope.</p>}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
        <label className="block text-xs font-semibold text-[var(--muted)]">Dodaj drugo takmičenje (zakači posle ručnih)</label>
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Pretraži po nazivu…"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
        />
        {hits.map((h) => (
          <button key={h.id} onClick={() => add(h)} className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-2)]">
            <span className="truncate font-semibold text-[var(--ink)]">{h.nameSr ?? h.name}</span>
            <span className="shrink-0 text-[var(--muted)]">{fmtDate(h.date, h.dateEnd)} · {h.level}</span>
          </button>
        ))}
      </div>

      {hidden.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Sakrivena takmičenja</p>
          {hidden.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 py-1 text-xs">
              <span className="truncate text-[var(--ink)]">{h.name} · {fmtDate(h.date, h.dateEnd)}</span>
              <button className={btn} onClick={() => unhide(h)}>Vrati</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={!dirty || saving} className="rounded-md px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--brand-primary)" }}>
          {saving ? "Čuvam…" : "Sačuvaj"}
        </button>
        <button onClick={() => put([])} disabled={saving || (plan.pinCount === 0 && plan.hidden.length === 0)} className={btn}>
          Vrati na automatski
        </button>
        {dirty && <span className="text-xs text-[var(--muted)]">Nesačuvane izmene</span>}
        {error && <span className="text-xs" style={{ color: "var(--error)" }}>{error}</span>}
      </div>
    </div>
  );
}
