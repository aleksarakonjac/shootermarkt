"use client";

import Link from "next/link";
import { useState } from "react";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/competition-utils";
import { formatDateRangeSr } from "@/lib/date-utils";

export type SourceRow = {
  id: number;
  name: string;
  date: string;
  dateEnd: string | null;
  location: string | null;
  level: string;
  siusId: string | null;
  issfId: string | null;
  slots: number;
};

const input = "w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]";

/** Inline editor for live-result sources; `importLink` adds the results-import shortcut (past events). */
export function CompetitionSources({ rows, importLink }: { rows: SourceRow[]; importLink?: boolean }) {
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {rows.map((r) => <Row key={r.id} row={r} importLink={importLink} />)}
    </ul>
  );
}

function Row({ row, importLink }: { row: SourceRow; importLink?: boolean }) {
  const [siusId, setSiusId] = useState(row.siusId ?? "");
  const [issfId, setIssfId] = useState(row.issfId ?? "");
  const [saved, setSaved] = useState({ siusId: row.siusId ?? "", issfId: row.issfId ?? "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = siusId !== saved.siusId || issfId !== saved.issfId;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/competitions/${row.id}/sources`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siusId, issfId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Greška" });
      setSaved({ siusId: siusId.trim(), issfId: issfId.trim() });
      setMsg({ ok: true, text: "Sačuvano" });
    } finally {
      setBusy(false);
    }
  }

  const hasSource = !!(saved.siusId || saved.issfId);
  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/admin/takmicenja/${row.id}/edit`} className="min-w-0 text-sm font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)]">{row.name}</Link>
        <span className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold" style={LEVEL_STYLE[row.level]}>{LEVEL_LABEL[row.level] ?? row.level}</span>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{formatDateRangeSr(row.date, row.dateEnd)}</span>
        {row.location && <span className="text-xs text-[var(--muted)]">{row.location}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[0.7rem]">
        <Flag ok={hasSource} label="Izvor za live" />
        <Flag ok={row.slots > 0} label="Satnica" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-[0.7rem] text-[var(--muted)]">SIUS UUID
          <input className={input} value={siusId} onChange={(e) => setSiusId(e.target.value)} placeholder="npr. 3f2a…" />
        </label>
        <label className="text-[0.7rem] text-[var(--muted)]">ISSF ID
          <input className={input} value={issfId} onChange={(e) => setIssfId(e.target.value)} placeholder="npr. 3277" inputMode="numeric" />
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={!dirty || busy} className="min-h-9 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-40">
            {busy ? "Čuvam…" : "Sačuvaj"}
          </button>
          {importLink && (
            <Link href="/admin/rezultati/period" className="min-h-9 content-center rounded-md border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]">Uvezi rezultate</Link>
          )}
        </div>
      </div>
      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-[var(--muted)]" : "text-[var(--danger)]"}`}>{msg.text}</p>}
    </li>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-medium ${ok ? "bg-[var(--surface-2)] text-[var(--ink)]" : "text-[var(--danger)] ring-1 ring-inset ring-current"}`}>
      {ok ? "✓" : "✕"} {label}{ok ? "" : " nedostaje"}
    </span>
  );
}
