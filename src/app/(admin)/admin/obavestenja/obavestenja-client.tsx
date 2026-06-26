"use client";

import { useState, useEffect } from "react";

interface CalendarAlert {
  id: number;
  source: string;
  eventName: string;
  changeType: string;
  data: {
    dateFrom?: string;
    dateTo?: string;
    location?: string;
    country?: string;
    url?: string;
    externalId?: string;
  } | null;
  seen: boolean;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = { sss: "SSS", issf: "ISSF", esc: "ESC" };
const SOURCE_COLORS: Record<string, string> = {
  sss: "oklch(0.55 0.18 150)",
  issf: "oklch(0.55 0.18 250)",
  esc: "oklch(0.55 0.18 30)",
};

export function ObavestenjaClient() {
  const [alerts, setAlerts] = useState<CalendarAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [showAll]);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/obavestenja${showAll ? "?all=1" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setAlerts(data);
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function markSeen(ids: number[], seen: boolean) {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/obavestenja", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, seen }),
      });
      if (!res.ok) throw new Error("Greška");
      await loadAlerts();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/obavestenja/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      await loadAlerts();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visible = alerts.filter((a) => !a.seen).map((a) => a.id);
    setSelected(selected.size === visible.length ? new Set() : new Set(visible));
  }

  const unseen = alerts.filter((a) => !a.seen);
  const allUnseenSelected = unseen.length > 0 && selected.size === unseen.length;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Obaveštenja
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Nova takmičenja detektovana u kalendarima (SSS / ISSF / ESC)
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
          >
            {syncing ? "Sinkronizujem..." : "Proveri kalendare sada"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Controls */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {unseen.length > 0 && (
            <span className="rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold px-2.5 py-0.5">
              {unseen.length} novo
            </span>
          )}
          <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[var(--brand-primary)]"
            />
            Prikaži pregledana
          </label>
        </div>

        {selected.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => markSeen(Array.from(selected), true)}
              disabled={syncing}
              className="rounded-md px-4 py-1.5 text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
            >
              Označi pregledano ({selected.size})
            </button>
            <button
              onClick={() => markSeen(Array.from(selected), false)}
              disabled={syncing}
              className="rounded-md border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
            >
              Označi novo
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] py-12 text-center text-sm text-[var(--muted)]">
          Učitavam...
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] py-16 text-center space-y-2">
          <p className="text-2xl">✓</p>
          <p className="text-sm font-semibold text-[var(--ink)]">Nema novih obaveštenja</p>
          <p className="text-xs text-[var(--muted)]">
            Cron proverava kalendare 1. u mesecu. Možeš i ručno pokrenuti proveru.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Header row */}
          <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2.5 flex items-center gap-3">
            <input
              type="checkbox"
              checked={allUnseenSelected}
              onChange={toggleAll}
              disabled={unseen.length === 0}
              className="accent-[var(--brand-primary)]"
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              {alerts.length} obaveštenja
            </span>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors ${a.seen ? "opacity-50" : "hover:bg-[var(--surface)]"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  disabled={a.seen}
                  className="mt-0.5 accent-[var(--brand-primary)]"
                />

                {/* Source dot */}
                <span
                  className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                  style={{ background: SOURCE_COLORS[a.source] ?? "var(--muted)" }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[var(--ink)]">{a.eventName}</span>
                    <span
                      className="text-[0.65rem] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: "var(--surface)", color: SOURCE_COLORS[a.source], border: "1px solid var(--border)" }}
                    >
                      {SOURCE_LABELS[a.source] ?? a.source}
                    </span>
                    {a.changeType === "new" && (
                      <span className="text-[0.65rem] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)", border: "1px solid var(--border)" }}>
                        Novo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-[var(--muted)]">
                    {a.data?.dateFrom && (
                      <span className="font-[family-name:var(--font-jetbrains-mono)]">
                        {formatDate(a.data.dateFrom)}
                        {a.data.dateTo && a.data.dateTo !== a.data.dateFrom && ` – ${formatDate(a.data.dateTo)}`}
                      </span>
                    )}
                    {(a.data?.location || a.data?.country) && (
                      <span>{[a.data.location, a.data.country].filter(Boolean).join(", ")}</span>
                    )}
                    <span className="text-[var(--subtle)]">
                      Detektovano {new Date(a.createdAt).toLocaleDateString("sr-RS")}
                    </span>
                  </div>
                </div>

                {/* Quick action */}
                {!a.seen && (
                  <button
                    onClick={() => markSeen([a.id], true)}
                    disabled={syncing}
                    className="shrink-0 text-xs text-[var(--subtle)] hover:text-[var(--ink)] transition-colors"
                    title="Označi pregledano"
                  >
                    ✓
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[var(--border)] p-4 text-xs text-[var(--muted)] space-y-1">
        <p className="font-semibold text-[var(--ink)] text-sm">Kako radi automatska provera</p>
        <p>Cron job se pokreće 1. u mesecu u 08:00. Proverava SSS, ISSF i ESC kalendare za tekuću i narednu godinu.</p>
        <p>Nova takmičenja (10m, koja nisu u bazi) pojavljuju se ovde. Pregleda ih admin i odlučuje da li ih importuje.</p>
        <p>Duplikati između izvora se filtriraju po sličnosti naziva.</p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
