"use client";

import { useState } from "react";
import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";

interface Props {
  rows: ReviewRow[];
  onRowChange: (idx: number, patch: Partial<ReviewRow>) => void;
  /** Od ovog indeksa redovi su članovi timova (godište, klub i preskakanje se tu ne menjaju). */
  memberFrom?: number;
  /** Od ovog indeksa su članovi mešovitih timova, čiji se pol bira. */
  mixedFrom?: number;
}

type Group = {
  sig: string;
  idxs: number[];
  row: ReviewRow; // representative (prvi u grupi)
};

/** Grupiše nove strelce (isNew) po identitetu; edit se primenjuje na sve njihove redove. */
function buildGroups(rows: ReviewRow[]): Group[] {
  const map = new Map<string, Group>();
  rows.forEach((r, idx) => {
    if (!r.isNew) return;
    const sig = `${r.lastName}|${r.firstName}|${r.teamNoc}`.toLowerCase();
    const g = map.get(sig);
    if (g) g.idxs.push(idx);
    else map.set(sig, { sig, idxs: [idx], row: r });
  });
  // pretpostavljena nacija ide na vrh — njih admin mora da pogleda
  return Array.from(map.values()).sort((a, b) => Number(!!b.row.nationAssumed) - Number(!!a.row.nationAssumed));
}

const inputCls =
  "w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]";

export function NewShootersPanel({ rows, onRowChange, memberFrom = Infinity, mixedFrom = Infinity }: Props) {
  const [bulkNoc, setBulkNoc] = useState("");
  const groups = buildGroups(rows);
  if (groups.length === 0) return null;

  const patchGroup = (idxs: number[], patch: Partial<ReviewRow>) => {
    idxs.forEach((i) => onRowChange(i, patch));
  };

  const activeGroups = groups.filter((g) => !g.row.skip);
  const assumed = activeGroups.filter((g) => g.row.nationAssumed);
  const confirmed = { nationAssumed: false, warning: undefined };

  return (
    <div className="rounded-xl border-2 border-[var(--warning)] bg-[var(--surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <div>
          <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] text-[1.05rem] tracking-tight leading-none">
            Novi strelci
          </h3>
          <p className="text-xs text-[var(--muted)] mt-1">
            {activeGroups.length} strelaca nije u bazi — biće kreirani pri unosu. Proveri
            ime, godište, klub i naciju.
          </p>
        </div>
        <span
          className="shrink-0 text-[0.7rem] font-bold uppercase tracking-wide px-2 py-1 rounded"
          style={{ background: "var(--warning)", color: "white" }}
        >
          {activeGroups.length}
        </span>
      </div>

      {assumed.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-2)]">
          <p className="text-xs text-[var(--ink)]">
            <strong>{assumed.length}</strong> strelaca ima pretpostavljenu naciju
            ({Array.from(new Set(assumed.map((g) => g.row.teamNoc || "nepoznata"))).join(", ")}): bilten navodi
            samo klub. Proveri da li su domaći.
          </p>
          <div className="flex items-center gap-2">
            <input
              aria-label="Nacija za sve pretpostavljene"
              value={bulkNoc}
              maxLength={3}
              placeholder="NOC"
              onChange={(e) => setBulkNoc(e.target.value.toUpperCase())}
              className={`${inputCls} !w-20 font-[family-name:var(--font-jetbrains-mono)] uppercase`}
            />
            <button
              onClick={() => assumed.forEach((g) => patchGroup(g.idxs, { ...(bulkNoc ? { teamNoc: bulkNoc } : {}), ...confirmed }))}
              className="text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded px-2 py-1.5 transition-colors whitespace-nowrap"
            >
              Postavi i potvrdi ({assumed.length})
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {groups.map((g) => {
          const r = g.row;
          const discs = Array.from(new Set(g.idxs.map((i) => rows[i].disciplineCode)));
          const teamOnly = g.idxs.every((i) => i >= memberFrom);
          // pol se bira samo kad ga ne zna nijedna pojedinačna ni klupska lista
          const pickGender = g.idxs.every((i) => i >= mixedFrom);
          return (
            <div
              key={g.idxs[0]}
              className={`px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end ${
                r.skip ? "opacity-40" : ""
              }`}
            >
              {/* Ime + prezime */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                    Prezime
                  </label>
                  <input
                    value={r.lastName}
                    onChange={(e) => patchGroup(g.idxs, { lastName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                    Ime
                  </label>
                  <input
                    value={r.firstName}
                    onChange={(e) => patchGroup(g.idxs, { firstName: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Godište + klub + nacija */}
              <div className="grid grid-cols-[80px_1fr_70px] gap-2">
                <div>
                  <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                    Godište
                  </label>
                  <input
                    type="number"
                    disabled={teamOnly}
                    value={r.birthYear ?? ""}
                    placeholder="—"
                    min={1940}
                    max={new Date().getFullYear()}
                    onChange={(e) =>
                      patchGroup(g.idxs, {
                        birthYear: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    className={`${inputCls} font-[family-name:var(--font-jetbrains-mono)]`}
                  />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                    Klub
                  </label>
                  <input
                    value={r.clubAbbr ?? ""}
                    disabled={teamOnly}
                    placeholder="—"
                    onChange={(e) => patchGroup(g.idxs, { clubAbbr: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                    Nacija
                  </label>
                  <input
                    value={r.teamNoc}
                    onChange={(e) =>
                      patchGroup(g.idxs, { teamNoc: e.target.value.toUpperCase() })
                    }
                    className={`${inputCls} font-[family-name:var(--font-jetbrains-mono)] uppercase`}
                  />
                </div>
              </div>

              {/* Meta + akcije */}
              <div className="flex items-center gap-2 justify-between sm:justify-end">
                {r.nationAssumed && (
                  <button
                    onClick={() => patchGroup(g.idxs, confirmed)}
                    title="Nacija je pretpostavljena — klikni kad proveriš"
                    className="text-xs font-semibold text-white rounded px-2 py-1 whitespace-nowrap"
                    style={{ background: "var(--warning)" }}
                  >
                    Potvrdi naciju
                  </button>
                )}
                <div className="flex gap-1">
                  {discs.map((d) => (
                    <span
                      key={d}
                      className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded font-[family-name:var(--font-jetbrains-mono)]"
                      style={{ background: "var(--surface-2)", color: "var(--muted)" }}
                      title={`${r.gender ?? "?"} · ${r.apparatus ?? "?"}`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
                {pickGender && (
                  <select
                    aria-label={`Pol: ${r.lastName} ${r.firstName}`}
                    value={r.gender ?? "M"}
                    onChange={(e) => patchGroup(g.idxs, { gender: e.target.value as "M" | "F" })}
                    className={`${inputCls} !w-16`}
                  >
                    <option value="M">M</option>
                    <option value="F">Ž</option>
                  </select>
                )}
                {r.suggestedShooterId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[0.7rem] text-[var(--muted)] whitespace-nowrap">
                      Možda: <span className="font-semibold text-[var(--ink)]">{r.suggestedName}</span>
                    </span>
                    <button
                      onClick={() =>
                        patchGroup(g.idxs, {
                          shooterId: r.suggestedShooterId,
                          isNew: false,
                          suggestedShooterId: undefined,
                          suggestedName: undefined,
                          warning: undefined,
                        })
                      }
                      className="text-xs font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded px-2 py-1 transition-colors whitespace-nowrap"
                      title={`Poveži sa postojećim: ${r.suggestedName}`}
                    >
                      Poveži
                    </button>
                  </div>
                ) : teamOnly ? null : (
                  <button
                    onClick={() => patchGroup(g.idxs, { skip: !r.skip })}
                    className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors whitespace-nowrap"
                  >
                    {r.skip ? "Vrati" : "Preskoči"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
