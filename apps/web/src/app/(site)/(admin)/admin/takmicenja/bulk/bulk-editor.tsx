"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVEL_LABEL } from "@/lib/competition-utils";
import { formatDateRangeSr } from "@/lib/date-utils";
import { AGE_CATEGORIES, EVENT_TYPES } from "../sync/sync-row-editor";
import { TAG_OPTIONS } from "../takmicenja-filters";

export type BulkMatch = { disciplineId: number; code: string; category: string; count: number };
export type BulkRow = {
  id: number;
  name: string;
  date: string;
  level: string;
  eventType: string;
  tags: string[];
  focusPriority: number | null;
  /** Podrazumevani prioritet kad je override prazan */
  autoPriority: number;
  matches: BulkMatch[];
};

type CompDraft = { name?: string; level?: string; eventType?: string; tags?: string; priority?: string };
const priorityText = (p: number | null) => (p == null ? "" : String(p));
const matchKey = (compId: number, m: BulkMatch) => `${compId}|${m.disciplineId}|${m.category}`;
const parseTags = (s: string) => [...new Set(s.split(",").map((t) => t.trim()).filter(Boolean))];

const selectCls = "w-full rounded border bg-[var(--bg)] px-1.5 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]";
const changedCls = "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]";

export function BulkEditor({ rows }: { rows: BulkRow[] }) {
  const router = useRouter();
  const [comps, setComps] = useState<Record<number, CompDraft>>({});
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkPriority, setBulkPriority] = useState("");
  const [editingName, setEditingName] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Samo stvarne razlike u odnosu na bazu
  const compChanges = rows.flatMap((r) => {
    const d = comps[r.id];
    if (!d) return [];
    const change: { id: number; name?: string; level?: string; eventType?: string; tags?: string[]; focusPriority?: number | null } = { id: r.id };
    if (d.name !== undefined && d.name.trim() && d.name.trim() !== r.name) change.name = d.name.trim();
    if (d.level !== undefined && d.level !== r.level) change.level = d.level;
    if (d.eventType !== undefined && d.eventType !== r.eventType) change.eventType = d.eventType;
    if (d.tags !== undefined && parseTags(d.tags).join(",") !== r.tags.join(",")) change.tags = parseTags(d.tags);
    if (d.priority !== undefined && d.priority.trim() !== priorityText(r.focusPriority)) {
      change.focusPriority = d.priority.trim() === "" ? null : Number(d.priority);
    }
    return Object.keys(change).length > 1 ? [change] : [];
  });
  const matchChanges = rows.flatMap((r) =>
    r.matches.flatMap((m) => {
      const to = matches[matchKey(r.id, m)];
      return to && to !== m.category ? [{ competitionId: r.id, disciplineId: m.disciplineId, from: m.category, to }] : [];
    })
  );
  const dirty = compChanges.length + matchChanges.length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const toggle = (id: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const applyBulkPriority = (value: string) => {
    for (const id of selected) setComps((prev) => ({ ...prev, [id]: { ...prev[id], priority: value } }));
  };
  const bulkPriorityValid = /^\d{1,2}$/.test(bulkPriority.trim()) && Number(bulkPriority) <= 20;

  const setComp = (id: number, patch: CompDraft) => setComps((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/competitions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitions: compChanges, matches: matchChanges }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: json.error ?? `Greška ${res.status}` });
        return;
      }
      setComps({});
      setMatches({});
      setMessage({ ok: true, text: `Sačuvano ${json.updated} izmena.` });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return <div className="rounded-xl border border-[var(--border)] py-16 text-center text-sm text-[var(--muted)]">Nema takmičenja za ovaj filter.</div>;
  }

  return (
    <>
      <datalist id="bulk-tag-options">
        {TAG_OPTIONS.map((t) => <option key={t.value} value={t.value} />)}
      </datalist>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
        <span className="text-[var(--muted)]">Izabrano: {selected.size}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          step={1}
          aria-label="Prioritet za izabrana takmičenja"
          value={bulkPriority}
          onChange={(e) => setBulkPriority(e.target.value)}
          placeholder="Prioritet 0–20"
          className="w-36 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
        />
        <button type="button" disabled={!selected.size || !bulkPriorityValid} onClick={() => applyBulkPriority(String(Number(bulkPriority)))} className="rounded-md border border-[var(--border-strong)] px-3 py-1 font-semibold text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-40">
          Postavi izabranima
        </button>
        <button type="button" disabled={!selected.size} onClick={() => applyBulkPriority("")} className="rounded-md border border-[var(--border-strong)] px-3 py-1 font-semibold text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-40">
          Vrati na auto
        </button>
        <span className="text-xs text-[var(--subtle)]">Manji broj = važnije (0 je vrh). Izmene se upisuju tek na „Sačuvaj“.</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <th className="w-8 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Izaberi sve prikazane"
                  checked={selected.size === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                />
              </th>
              <th className="px-3 py-2.5">Takmičenje</th>
              <th className="w-24 px-3 py-2.5">Prioritet</th>
              <th className="w-36 px-3 py-2.5">Nivo</th>
              <th className="w-40 px-3 py-2.5">Tip</th>
              <th className="w-44 px-3 py-2.5">Tagovi</th>
              <th className="px-3 py-2.5">Mečevi · kategorija</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => {
              const d = comps[r.id] ?? {};
              const name = d.name ?? r.name;
              const level = d.level ?? r.level;
              const eventType = d.eventType ?? r.eventType;
              const tags = d.tags ?? r.tags.join(", ");
              const priority = d.priority ?? priorityText(r.focusPriority);
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" aria-label={`Izaberi: ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`font-medium text-[var(--ink)] ${name.trim() !== r.name ? "text-[var(--brand-primary)]" : ""}`}>{name}</div>
                    <button type="button" onClick={() => setEditingName(r.id)} className="mt-1 rounded border border-[var(--border-strong)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--ink)] hover:bg-[var(--surface)]">
                      Izmeni ime
                    </button>
                    <div className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.7rem] text-[var(--subtle)]">{formatDateRangeSr(r.date, null)} · #{r.id} · <a href={`/admin/takmicenja/${r.id}/edit`} className="hover:text-[var(--brand-primary)]">uredi</a></div>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={20}
                      step={1}
                      aria-label={`Prioritet: ${r.name}`}
                      value={priority}
                      onChange={(e) => setComp(r.id, { priority: e.target.value })}
                      placeholder={`Auto (${r.autoPriority})`}
                      className={`${selectCls} ${priority.trim() !== priorityText(r.focusPriority) ? changedCls : "border-[var(--border)]"}`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <select aria-label={`Nivo: ${r.name}`} value={level} onChange={(e) => setComp(r.id, { level: e.target.value })} className={`${selectCls} ${level !== r.level ? changedCls : "border-[var(--border)]"}`}>
                      {Object.entries(LEVEL_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select aria-label={`Tip: ${r.name}`} value={eventType} onChange={(e) => setComp(r.id, { eventType: e.target.value })} className={`${selectCls} ${eventType !== r.eventType ? changedCls : "border-[var(--border)]"}`}>
                      {EVENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      aria-label={`Tagovi: ${r.name}`}
                      list="bulk-tag-options"
                      value={tags}
                      onChange={(e) => setComp(r.id, { tags: e.target.value })}
                      placeholder="npr. issf, 10m"
                      className={`${selectCls} ${parseTags(tags).join(",") !== r.tags.join(",") ? changedCls : "border-[var(--border)]"}`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {r.matches.length === 0 ? (
                      <span className="text-xs text-[var(--subtle)]">bez rezultata</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {r.matches.map((m) => {
                          const key = matchKey(r.id, m);
                          const value = matches[key] ?? m.category;
                          return (
                            <label key={key} className="flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface)] py-0.5 pl-1.5 pr-0.5 text-[0.7rem]">
                              <span className="font-semibold text-[var(--ink)]">{m.code}</span>
                              <span className="text-[var(--subtle)]">{m.count}</span>
                              <select
                                aria-label={`Kategorija ${m.code} (${m.count} rezultata): ${r.name}`}
                                value={value}
                                onChange={(e) => setMatches((prev) => ({ ...prev, [key]: e.target.value }))}
                                className={`rounded border bg-[var(--bg)] px-1 py-0.5 text-[0.7rem] ${value !== m.category ? changedCls : "border-[var(--border)]"}`}
                              >
                                {AGE_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingName != null && (() => {
        const r = rows.find((x) => x.id === editingName);
        if (!r) return null;
        const close = () => setEditingName(null);
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[20vh]" onMouseDown={close}>
            <div role="dialog" aria-label="Izmena imena takmičenja" className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Ime takmičenja · #{r.id}</label>
              <textarea
                autoFocus
                rows={3}
                maxLength={300}
                value={comps[r.id]?.name ?? r.name}
                onChange={(e) => setComp(r.id, { name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); close(); } }}
                className="w-full resize-none rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => { setComp(r.id, { name: undefined }); close(); }} className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)]">Vrati original</button>
                <button type="button" onClick={close} className="rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]">Gotovo</button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 shadow-lg">
        <span className="text-sm text-[var(--muted)]">
          {dirty ? `Izmena za čuvanje: ${dirty}` : "Nema izmena"}
        </span>
        {message && (
          <span role="status" className="text-sm font-medium" style={{ color: message.ok ? "var(--success)" : "var(--brand-primary)" }}>
            {message.text}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => { setComps({}); setMatches({}); setMessage(null); }}
            disabled={!dirty || saving}
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-40"
          >
            Poništi
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-40"
          >
            {saving ? "Čuvam…" : "Sačuvaj"}
          </button>
        </div>
      </div>
    </>
  );
}
