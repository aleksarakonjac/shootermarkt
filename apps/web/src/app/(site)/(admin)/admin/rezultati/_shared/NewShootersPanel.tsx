"use client";

import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";

interface Props {
  rows: ReviewRow[];
  onRowChange: (idx: number, patch: Partial<ReviewRow>) => void;
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
  return Array.from(map.values());
}

const inputCls =
  "w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]";

export function NewShootersPanel({ rows, onRowChange }: Props) {
  const groups = buildGroups(rows);
  if (groups.length === 0) return null;

  const patchGroup = (idxs: number[], patch: Partial<ReviewRow>) => {
    idxs.forEach((i) => onRowChange(i, patch));
  };

  const activeGroups = groups.filter((g) => !g.row.skip);

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

      <div className="divide-y divide-[var(--border)]">
        {groups.map((g) => {
          const r = g.row;
          const discs = Array.from(new Set(g.idxs.map((i) => rows[i].disciplineCode)));
          return (
            <div
              key={g.sig}
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
                ) : (
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
