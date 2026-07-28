"use client";

import { useState, useEffect } from "react";
import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";

type ShooterHit = { id: number; firstName: string; lastName: string; nationality: string | null; clubName: string | null };

interface UnmatchedShooter {
  key: string;
  lastName: string;
  firstName: string;
  teamNoc: string;
  issfId?: string;
  disciplines: string[];
  rowIndices: number[];
  clubAbbr?: string;
  gender?: "M" | "F";
  apparatus?: string;
}

type ActionType = "pending" | "link" | "create" | "skip";

interface CreateProfile {
  firstName: string;
  lastName: string;
  nationality: string;
  birthYear: string;
  clubAbbr: string;
}

interface ImportedShooter {
  id: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  birthYear: number | null;
  apparatus: string | null;
  avatarUrl: string | null;
}

function ShooterSearch({ defaultQuery, onPick }: { defaultQuery: string; onPick: (hit: ShooterHit) => void }) {
  const [query, setQuery] = useState(defaultQuery);
  const [hits, setHits] = useState<ShooterHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/shooters?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(Array.isArray(data) ? data.slice(0, 8) : []);
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Pretraži po imenu…"
        className="w-full text-sm px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
      />
      {loading && <p className="text-xs text-[var(--subtle)]">Tražim…</p>}
      {!loading && hits.length === 0 && query.trim().length >= 2 && (
        <p className="text-xs text-[var(--subtle)]">Nema rezultata.</p>
      )}
      <div className="space-y-0.5">
        {hits.map((h) => (
          <button
            key={h.id}
            onClick={() => onPick(h)}
            className="w-full text-left px-3 py-1.5 rounded-md text-xs hover:bg-[var(--surface-2)] flex items-center justify-between gap-2"
          >
            <span className="font-semibold text-[var(--ink)]">{h.lastName} {h.firstName}</span>
            <span className="text-[0.65rem] text-[var(--subtle)] shrink-0">
              {h.nationality ?? ""}{h.clubName ? ` · ${h.clubName}` : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const APPARATUS_LABEL: Record<string, string> = {
  rifle: "Puška", pistol: "Pištolj", both: "Puška + Pištolj", shotgun: "Trap/Skeet",
};

interface Props {
  rows: ReviewRow[];
  onRowChange: (idx: number, patch: Partial<ReviewRow>) => void;
}

export function UnmatchedPanel({ rows, onRowChange }: Props) {
  const [actions, setActions] = useState<Record<string, ActionType>>({});
  const [profiles, setProfiles] = useState<Record<string, CreateProfile>>({});
  const [linked, setLinked] = useState<Record<string, ShooterHit>>({});
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [issfLoading, setIssfLoading] = useState<Record<string, boolean>>({});
  const [issfImported, setIssfImported] = useState<Record<string, ImportedShooter>>({});
  const [issfError, setIssfError] = useState<Record<string, string>>({});

  const unmatched: UnmatchedShooter[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.shooterId || row.skip) continue;
    const key = `${row.lastName}|${row.firstName}|${row.teamNoc}`;
    if (!seen.has(key)) {
      seen.add(key);
      unmatched.push({
        key, lastName: row.lastName, firstName: row.firstName, teamNoc: row.teamNoc,
        issfId: row.issfId,
        disciplines: [], rowIndices: [],
        clubAbbr: row.clubAbbr, gender: row.gender, apparatus: row.apparatus,
      });
    }
    const u = unmatched.find((u) => u.key === key)!;
    if (!u.disciplines.includes(row.disciplineCode)) u.disciplines.push(row.disciplineCode);
    u.rowIndices.push(i);
  }

  if (unmatched.length === 0) return null;

  function getAction(key: string): ActionType { return actions[key] ?? "pending"; }

  function setAction(key: string, action: ActionType, u: UnmatchedShooter) {
    setActions((prev) => ({ ...prev, [key]: action }));
    setApplied((prev) => { const next = new Set(prev); next.delete(key); return next; });
    if (action === "create" && !profiles[key]) {
      setProfiles((prev) => ({
        ...prev,
        [key]: { firstName: u.firstName, lastName: u.lastName, nationality: u.teamNoc, birthYear: "", clubAbbr: u.clubAbbr ?? "" },
      }));
    }
  }

  function patchProfile(key: string, patch: Partial<CreateProfile>) {
    setProfiles((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function importFromIssf(u: UnmatchedShooter) {
    if (!u.issfId) return;
    setIssfLoading((prev) => ({ ...prev, [u.key]: true }));
    setIssfError((prev) => { const n = { ...prev }; delete n[u.key]; return n; });
    try {
      const res = await fetch("/api/admin/issf/athletes/import-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issfId: u.issfId, nationCode: u.teamNoc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      const shooter: ImportedShooter = data.shooter;
      setIssfImported((prev) => ({ ...prev, [u.key]: shooter }));
      // auto-apply link
      u.rowIndices.forEach((i) => onRowChange(i, {
        shooterId: shooter.id, isNew: false, warning: undefined,
        suggestedShooterId: undefined, suggestedName: undefined,
      }));
      setApplied((prev) => new Set(prev).add(u.key));
    } catch (e) {
      setIssfError((prev) => ({ ...prev, [u.key]: String(e) }));
    } finally {
      setIssfLoading((prev) => { const n = { ...prev }; delete n[u.key]; return n; });
    }
  }

  function apply(u: UnmatchedShooter) {
    const action = getAction(u.key);
    if (action === "pending") return;

    if (action === "skip") {
      u.rowIndices.forEach((i) => onRowChange(i, { skip: true }));
    } else if (action === "link") {
      const hit = linked[u.key];
      if (!hit) return;
      u.rowIndices.forEach((i) => onRowChange(i, { shooterId: hit.id, isNew: false, warning: undefined, suggestedShooterId: undefined, suggestedName: undefined }));
    } else if (action === "create") {
      const p = profiles[u.key];
      if (!p) return;
      u.rowIndices.forEach((i) => onRowChange(i, {
        firstName: p.firstName, lastName: p.lastName,
        teamNoc: p.nationality, clubAbbr: p.clubAbbr || undefined,
        birthYear: p.birthYear ? parseInt(p.birthYear) : undefined,
        isNew: true, warning: "Novi strelac — biće kreiran", shooterId: undefined,
      }));
    }

    setApplied((prev) => new Set(prev).add(u.key));
  }

  const pending = unmatched.filter((u) => !applied.has(u.key));
  const done = unmatched.filter((u) => applied.has(u.key));

  return (
    <div className="rounded-xl border-2 border-[var(--warning)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "oklch(0.97 0.04 85)" }}>
        <span className="text-base leading-none">⚠</span>
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">{unmatched.length} strelaca nije pronađeno u bazi</p>
          <p className="text-xs text-[var(--muted)]">Odluči šta da radiš sa svakim pre uvoza</p>
        </div>
        <span className="ml-auto font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--muted)]">
          {done.length}/{unmatched.length} obrađeno
        </span>
      </div>

      {/* Cards */}
      <div className="divide-y divide-[var(--border)]">
        {unmatched.map((u) => {
          const action = getAction(u.key);
          const isApplied = applied.has(u.key);
          const canApply = action !== "pending" && (action !== "link" || !!linked[u.key]);
          const imported = issfImported[u.key];
          const fetchingIssf = !!issfLoading[u.key];

          return (
            <div key={u.key} className="p-4 space-y-3" style={{ opacity: isApplied ? 0.5 : 1 }}>
              {/* Shooter identity */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--ink)]">
                    {u.lastName} {u.firstName}
                    <span className="ml-2 font-[family-name:var(--font-jetbrains-mono)] text-xs font-normal text-[var(--muted)]">{u.teamNoc}</span>
                    {u.issfId && (
                      <span className="ml-2 font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] text-[var(--subtle)]">ISSF#{u.issfId}</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {u.disciplines.join(" · ")}
                    {u.clubAbbr ? ` · ${u.clubAbbr}` : ""}
                  </p>
                </div>
                {isApplied && (
                  <span className="text-xs font-semibold shrink-0" style={{ color: "var(--success)" }}>
                    {imported
                      ? `✓ Uvezen sa ISSF (ID ${imported.id})`
                      : action === "skip" ? "✓ Isključen"
                      : action === "link" ? `✓ Povezan sa ${linked[u.key]?.lastName}`
                      : "✓ Kreiraće se novi"}
                  </span>
                )}
              </div>

              {/* ISSF import preview (after successful fetch, before apply) */}
              {imported && isApplied && (
                <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-2.5 bg-[var(--surface)]">
                  {imported.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imported.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{imported.lastName} {imported.firstName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {imported.nationality}{imported.birthYear ? ` · ${imported.birthYear}` : ""}
                      {imported.apparatus ? ` · ${APPARATUS_LABEL[imported.apparatus] ?? imported.apparatus}` : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isApplied && (
                <>
                  <div className="flex flex-wrap gap-1">
                    {/* ISSF fetch button — only when issfId available */}
                    {u.issfId && (
                      <button
                        onClick={() => importFromIssf(u)}
                        disabled={fetchingIssf}
                        className="px-3 py-1 rounded-md text-xs font-semibold transition-colors border disabled:opacity-50"
                        style={{ background: "oklch(0.95 0.04 260)", borderColor: "oklch(0.7 0.12 260)", color: "oklch(0.3 0.12 260)" }}
                      >
                        {fetchingIssf ? "Preuzimam…" : "⬇ Preuzmi sa ISSF"}
                      </button>
                    )}
                    {(["link", "create", "skip"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setAction(u.key, a, u)}
                        className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                        style={
                          action === a
                            ? { background: a === "skip" ? "oklch(0.55 0.18 25)" : "var(--brand-primary)", color: "white" }
                            : { background: "var(--surface-2)", color: "var(--muted)" }
                        }
                      >
                        {a === "link" ? "Poveži sa postojećim" : a === "create" ? "Kreiraj novog" : "Isključi"}
                      </button>
                    ))}
                  </div>

                  {issfError[u.key] && (
                    <p className="text-xs" style={{ color: "var(--error)" }}>ISSF greška: {issfError[u.key]}</p>
                  )}

                  {/* Action body */}
                  {action === "link" && (
                    <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface)]">
                      {linked[u.key] ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--ink)]">{linked[u.key].lastName} {linked[u.key].firstName}</span>
                          <span className="text-xs text-[var(--muted)]">{linked[u.key].nationality}</span>
                          <button
                            onClick={() => setLinked((prev) => { const n = { ...prev }; delete n[u.key]; return n; })}
                            className="ml-auto text-xs text-[var(--subtle)] hover:text-[var(--brand-primary)]"
                          >promeni</button>
                        </div>
                      ) : (
                        <ShooterSearch
                          defaultQuery={`${u.lastName} ${u.firstName}`}
                          onPick={(hit) => setLinked((prev) => ({ ...prev, [u.key]: hit }))}
                        />
                      )}
                    </div>
                  )}

                  {action === "create" && profiles[u.key] && (
                    <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface)] grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {([
                        ["Prezime", "lastName"],
                        ["Ime", "firstName"],
                        ["Nacionalnost", "nationality"],
                        ["Godište", "birthYear"],
                        ["Klub (skraćenica)", "clubAbbr"],
                      ] as const).map(([label, field]) => (
                        <label key={field} className="flex flex-col gap-0.5">
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
                          <input
                            value={profiles[u.key][field]}
                            onChange={(e) => patchProfile(u.key, { [field]: e.target.value })}
                            className="text-sm px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {action === "skip" && (
                    <p className="text-xs text-[var(--muted)]">Svi redovi za ovog strelca biće preskočeni pri uvozu.</p>
                  )}

                  {action !== "pending" && (
                    <button
                      onClick={() => apply(u)}
                      disabled={!canApply}
                      className="px-4 py-1.5 rounded-md text-xs font-semibold text-white transition-colors disabled:opacity-40"
                      style={{ background: "var(--brand-primary)" }}
                    >
                      Primeni →
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
