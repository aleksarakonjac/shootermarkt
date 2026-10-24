"use client";

import { useEffect, useMemo, useState } from "react";

type Side = "keep" | "drop";
type Shooter = {
  id: number; firstName: string; lastName: string; birthDate: string | null; gender: string | null; nationality: string | null;
  clubId: number | null; apparatus: string | null; avatarUrl: string | null; issfId: string | null; siusAthleteId: string | null;
};
type Res = {
  id: number; side: Side; competition: string; date: string; discipline: string; category: string;
  qualTotal: string | null; qualRank: number | null; finalRank: number | null; source: string; clashWith: number | null;
};
type Preview = { keep: Shooter; drop: Shooter; results: Res[] };

const FIELDS: { key: keyof Shooter; label: string }[] = [
  { key: "firstName", label: "Ime" },
  { key: "lastName", label: "Prezime" },
  { key: "birthDate", label: "Datum rođenja" },
  { key: "gender", label: "Pol" },
  { key: "nationality", label: "Država" },
  { key: "clubId", label: "Klub (ID)" },
  { key: "apparatus", label: "Oružje" },
  { key: "avatarUrl", label: "Slika" },
  { key: "issfId", label: "ISSF ID" },
  { key: "siusAthleteId", label: "SIUS ID" },
];

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

interface Props {
  keepId: number;
  otherId: number;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Spaja drugog strelca (other) u ovog (keep): po polju biraš čija vrednost ostaje, a rezultate biraš pojedinačno
 * ili sve odjednom. Dva rezultata za isti meč: ostaje jedan. Neizabrani rezultati se brišu.
 */
export function MergeShootersModal({ keepId, otherId, onClose, onDone }: Props) {
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Partial<Record<keyof Shooter, Side>>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/shooters/${keepId}/merge?other=${otherId}`);
      const d = await res.json();
      if (cancelled) return;
      if (!res.ok) { setError(d.error ?? "Greška"); return; }
      const p = d as Preview;
      setData(p);
      // Default: vrednost ovog strelca, a ako je nema, drugog. Rezultati: svi; za isti meč ostaje rezultat ovog strelca.
      const f: Partial<Record<keyof Shooter, Side>> = {};
      for (const { key } of FIELDS) f[key] = p.keep[key] == null || p.keep[key] === "" ? "drop" : "keep";
      setFields(f);
      setSelected(new Set(p.results.filter((r) => r.side === "keep" || r.clashWith === null).map((r) => r.id)));
    })();
    return () => { cancelled = true; };
  }, [keepId, otherId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const byId = useMemo(() => new Map(data?.results.map((r) => [r.id, r]) ?? []), [data]);

  function toggle(r: Res) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(r.id)) n.delete(r.id);
      else { n.add(r.id); if (r.clashWith) n.delete(r.clashWith); }
      return n;
    });
  }

  function preset(kind: "all" | "keep" | "drop") {
    if (!data) return;
    const pickIds = (side: Side) => data.results.filter((r) => r.side === side).map((r) => r.id);
    if (kind === "keep") return setSelected(new Set(pickIds("keep")));
    if (kind === "drop") return setSelected(new Set(pickIds("drop")));
    // Svi: što god nije dupli meč, a za dupli meč rezultat ovog strelca
    setSelected(new Set(data.results.filter((r) => r.side === "keep" || r.clashWith === null).map((r) => r.id)));
  }

  async function submit() {
    if (!data) return;
    const dropCount = [...selected].filter((id) => byId.get(id)?.side === "drop").length;
    const removed = data.results.length - selected.size;
    const msg = `Spojiti "${data.drop.lastName} ${data.drop.firstName}" (#${data.drop.id}) u ovog strelca?\n\n` +
      `Strelac #${data.drop.id} se trajno briše. Prebacuje se rezultata: ${dropCount}.` +
      (removed ? `\nTrajno se brišu rezultati koje nisi izabrao: ${removed}.` : "");
    if (!confirm(msg)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/shooters/${keepId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherId, fields, resultIds: [...selected] }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Greška"); return; }
    onDone();
  }

  const radio = (key: keyof Shooter, side: Side, disabled: boolean) => (
    <input type="radio" name={`f-${key}`} checked={fields[key] === side} disabled={disabled} onChange={() => setFields((p) => ({ ...p, [key]: side }))} />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Spajanje strelaca" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-xl bg-[var(--bg,white)] p-5 shadow-xl border border-[var(--border)] text-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--ink)]">Spoji strelce</h2>
            <p className="text-xs text-[var(--muted)]">Ovaj strelac ostaje; drugi se briše posle prenosa izabranog.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="text-[var(--subtle)] hover:text-[var(--ink)]" aria-label="Zatvori">×</button>
        </div>

        {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        {!data && !error && <p className="py-8 text-center text-[var(--muted)]">Učitavam…</p>}

        {data && (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Podaci</h3>
            <div className="rounded-lg border border-[var(--border)] overflow-hidden mb-5">
              <div className="grid grid-cols-[7rem_1fr_1fr] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">
                <span />
                <span>Ovaj (#{data.keep.id})</span>
                <span>Drugi (#{data.drop.id})</span>
              </div>
              {FIELDS.map(({ key, label }) => {
                const a = data.keep[key], b = data.drop[key];
                const same = a === b;
                return (
                  <div key={key} className={`grid grid-cols-[7rem_1fr_1fr] items-center px-3 py-1.5 border-t border-[var(--border)] ${same ? "text-[var(--subtle)]" : ""}`}>
                    <span className="text-xs text-[var(--muted)]">{label}</span>
                    <label className="flex items-center gap-2 min-w-0">{radio(key, "keep", same)}<span className="truncate">{show(a)}</span></label>
                    <label className="flex items-center gap-2 min-w-0">{radio(key, "drop", same)}<span className="truncate">{show(b)}</span></label>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mr-auto">
                Rezultati <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)]">{selected.size}/{data.results.length}</span>
              </h3>
              <button onClick={() => preset("all")} className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold hover:bg-[var(--surface)]">Svi</button>
              <button onClick={() => preset("keep")} className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold hover:bg-[var(--surface)]">Samo od ovog</button>
              <button onClick={() => preset("drop")} className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold hover:bg-[var(--surface)]">Samo od drugog</button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--border)]">
              {data.results.length === 0 && <p className="px-3 py-4 text-center text-xs text-[var(--muted)]">Nijedan od njih nema rezultate.</p>}
              {data.results.map((r) => (
                <label key={r.id} className={`flex items-center gap-3 px-3 py-1.5 border-b border-[var(--border)] last:border-b-0 cursor-pointer ${selected.has(r.id) ? "" : "opacity-50"} ${r.clashWith ? "bg-amber-50" : ""}`}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r)} />
                  <span className="w-14 shrink-0 text-[10px] font-bold uppercase text-[var(--muted)]">{r.side === "keep" ? "Ovaj" : "Drugi"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.competition}</span>
                    <span className="text-xs text-[var(--muted)]">{r.date} · {r.discipline} · {r.category} · {r.source}{r.clashWith ? " · isti meč kod oba" : ""}</span>
                  </span>
                  <span className="shrink-0 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs">
                    {show(r.qualTotal)}<span className="block text-[var(--muted)]">{r.qualRank ? `#${r.qualRank}` : ""}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Neizabrani rezultati se brišu. Za isti meč kod oba može ostati samo jedan.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} disabled={busy} className="rounded-md border border-[var(--border)] px-4 py-1.5 font-semibold hover:bg-[var(--surface)] disabled:opacity-50">Otkaži</button>
              <button onClick={submit} disabled={busy} className="rounded-md bg-[var(--brand-primary)] px-4 py-1.5 font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50">
                {busy ? "Spajam…" : "Spoji"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
