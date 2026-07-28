"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { NOC_LIST, displayNoc } from "@shootermarkt/db/noc-list";
import { trendLabel, type Trend } from "@/lib/forma";
import { type ShooterOption } from "@/components/ui/ShooterSearchSelect";
import { useScopedHref } from "@/hooks/use-scoped-href";

function nocAlpha2(noc: string | null | undefined): string | null {
  if (!noc) return null;
  return NOC_LIST.find((n) => n.noc === displayNoc(noc))?.alpha2 ?? null;
}

// ── Inline search input ──────────────────────────────────────────────────────

function ShooterInlineSearch({
  value,
  onChange,
  excludeId,
  placeholder,
  label,
}: {
  value: ShooterOption | null;
  onChange: (s: ShooterOption) => void;
  excludeId: number | null;
  placeholder: string;
  label: string;
}) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShooterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);

  // When a shooter is selected, show their name in the input
  const displayValue = open ? query : (value ? `${value.lastName} ${value.firstName}` : query);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cms/shooters-search?q=${encodeURIComponent(q)}`);
        const data: ShooterOption[] = await res.json();
        if (!cancelled) {
          setResults(data.filter((s) => s.id !== excludeId));
          setFocusedIdx(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, query, excludeId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (s: ShooterOption) => {
    onChange(s);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[focusedIdx]) select(results[focusedIdx]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  const a2 = value ? nocAlpha2(value.nationality) : null;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</span>

      {/* Selected display — shown when not open */}
      {value && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2.5 text-left text-sm text-[var(--ink)] transition-colors hover:border-[var(--brand-primary)]"
        >
          {a2 && <span className={`fi fi-${a2.toLowerCase()} shrink-0`} style={{ width: "14px", height: "10px", borderRadius: "2px", display: "inline-block" }} aria-hidden="true" />}
          <span className="flex-1 min-w-0 truncate font-semibold">{value.lastName} {value.firstName}</span>
          {value.clubName && <span className="shrink-0 text-xs text-[var(--muted)] hidden sm:block truncate max-w-[100px]">{value.clubName}</span>}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange({ ...value, id: -1 } as never); setQuery(""); }}
            className="shrink-0 text-[var(--subtle)] hover:text-[var(--ink)] transition-colors ml-auto"
            aria-label="Obriši izbor"
            onClickCapture={(e) => { e.stopPropagation(); select({ id: -1 } as never); setResults([]); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </button>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={results[focusedIdx] ? `${listboxId}-${results[focusedIdx].id}` : undefined}
            value={displayValue}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
          />
          {open && (query.length >= 2 || results.length > 0) && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-1 max-h-[min(280px,calc(100vh-12rem))] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1 shadow-[0_4px_8px_oklch(0_0_0/0.12)]"
            >
              {loading ? (
                <li className="px-3 py-3 text-center text-sm text-[var(--muted)]">Tražim…</li>
              ) : results.length === 0 ? (
                <li className="px-3 py-3 text-center text-sm text-[var(--muted)]">
                  {query.trim().length < 2 ? "Ukucaj bar 2 slova…" : "Nema poklapanja"}
                </li>
              ) : results.map((s, i) => {
                const sa2 = nocAlpha2(s.nationality);
                return (
                  <li
                    key={s.id}
                    id={`${listboxId}-${s.id}`}
                    role="option"
                    aria-selected={i === focusedIdx}
                    onMouseEnter={() => setFocusedIdx(i)}
                    onClick={() => select(s)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${i === focusedIdx ? "bg-[var(--surface)]" : ""}`}
                  >
                    {sa2 && <span className={`fi fi-${sa2.toLowerCase()} shrink-0`} style={{ width: "14px", height: "10px", borderRadius: "2px", display: "inline-block" }} aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[var(--ink)]">{s.lastName} {s.firstName}</span>
                      {s.clubName && <span className="block truncate text-xs text-[var(--muted)]">{s.clubName}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type DiscStat = {
  disciplineCode: string;
  forma: number | null;
  trend: string | null;
  peak: number | null;
  best3avg: number | null;
  seasonAvg: number | null;
  recent3avg: number | null;
  appearances: number;
};

type Match = {
  discCode: string;
  competitionId: number;
  competitionName: string;
  date: string;
  qualTotal: number;
  qualRank: number | null;
};

type ShooterData = {
  shooterId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  clubName: string | null;
  stats: DiscStat[];
  matches: Match[];
};

type H2HData = {
  p1: ShooterData;
  p2: ShooterData;
  seasonLabel: string;
};

export type H2HClientLabels = {
  h2hPickPrompt: string;
  h2hSwap: string;
  h2hPickBoth: string;
  h2hCommonMeets: string;
  h2hNoCommonMeets: string;
  h2hStat_forma: string;
  h2hStat_peak: string;
  h2hStat_best3: string;
  h2hStat_seasonAvg: string;
  h2hStat_recent3: string;
  h2hStat_appearances: string;
};

// ── Sub-components ───────────────────────────────────────────────────────────

function fmt(v: number | null): string {
  return v === null ? "—" : v.toFixed(1);
}

function StatRow({ label, v1, v2 }: { label: string; v1: number | null; v2: number | null }) {
  const p1Wins = v1 !== null && (v2 === null || v1 > v2);
  const p2Wins = v2 !== null && (v1 === null || v2 > v1);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-right text-base" style={{ color: p1Wins ? "var(--brand-primary)" : "var(--ink)" }}>
        {v1 !== null ? fmt(v1) : <span className="text-[var(--subtle)]">—</span>}
      </span>
      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] text-center whitespace-nowrap px-2">{label}</span>
      <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-base" style={{ color: p2Wins ? "var(--brand-primary)" : "var(--ink)" }}>
        {v2 !== null ? fmt(v2) : <span className="text-[var(--subtle)]">—</span>}
      </span>
    </div>
  );
}

function ShooterHeader({ shooter, scopedHref }: { shooter: ShooterData | null; scopedHref: (p: string) => string }) {
  if (!shooter) {
    return (
      <div className="flex flex-col items-center text-center gap-1 py-2">
        <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] border border-[var(--border)]" />
        <span className="text-xs text-[var(--subtle)]">—</span>
      </div>
    );
  }
  const a2 = nocAlpha2(shooter.nationality);
  return (
    <Link href={scopedHref(`/strelci/${shooter.shooterId}`)} className="flex flex-col items-center text-center gap-1.5 py-2 group">
      <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] flex items-center justify-center border border-[var(--border)]">
        <span className="font-bold text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] select-none">
          {shooter.firstName[0]}{shooter.lastName[0]}
        </span>
      </div>
      <div>
        <div className="font-semibold text-sm text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors leading-snug">
          {shooter.lastName} {shooter.firstName}
        </div>
        {(a2 || shooter.clubName) && (
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {a2 && <span className={`fi fi-${a2.toLowerCase()} shrink-0`} style={{ width: "12px", height: "8px", borderRadius: "1px", display: "inline-block" }} />}
            {shooter.clubName && <span className="text-[0.7rem] text-[var(--muted)]">{shooter.clubName}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  labels: H2HClientLabels;
  initialP1?: number;
  initialP2?: number;
}

export function H2HClient({ labels, initialP1, initialP2 }: Props) {
  const scopedHref = useScopedHref();

  const [p1, setP1] = useState<ShooterOption | null>(null);
  const [p2, setP2] = useState<ShooterOption | null>(null);
  const [data, setData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const initialP1Ref = useRef(initialP1);
  const initialP2Ref = useRef(initialP2);

  const p1Id = p1?.id ?? initialP1Ref.current ?? null;
  const p2Id = p2?.id ?? initialP2Ref.current ?? null;

  useEffect(() => {
    if (!p1Id || !p2Id) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/h2h?a=${p1Id}&b=${p2Id}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: H2HData) => {
        if (cancelled) return;
        setData(d);
        if (!p1) setP1({ id: d.p1.shooterId, firstName: d.p1.firstName, lastName: d.p1.lastName, nationality: d.p1.nationality, clubName: d.p1.clubName });
        if (!p2) setP2({ id: d.p2.shooterId, firstName: d.p2.firstName, lastName: d.p2.lastName, nationality: d.p2.nationality, clubName: d.p2.clubName });
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1Id, p2Id]);

  const sharedDiscs = useMemo((): string[] => {
    if (!data) return [];
    const codes1 = new Set([...data.p1.stats.map((s) => s.disciplineCode), ...data.p1.matches.map((m) => m.discCode)]);
    const codes2 = new Set([...data.p2.stats.map((s) => s.disciplineCode), ...data.p2.matches.map((m) => m.discCode)]);
    return [...codes1].filter((c) => codes2.has(c)).sort();
  }, [data]);

  const commonMeetsByDisc = useMemo(() => {
    if (!data) return new Map<string, { m1: Match; m2: Match }[]>();
    const map = new Map<string, { m1: Match; m2: Match }[]>();
    for (const disc of sharedDiscs) {
      const p2ByComp = new Map(data.p2.matches.filter((m) => m.discCode === disc).map((m) => [m.competitionId, m]));
      const meets = data.p1.matches
        .filter((m) => m.discCode === disc && p2ByComp.has(m.competitionId))
        .map((m1) => ({ m1, m2: p2ByComp.get(m1.competitionId)! }))
        .sort((a, b) => (a.m1.date < b.m1.date ? 1 : -1));
      if (meets.length) map.set(disc, meets);
    }
    return map;
  }, [data, sharedDiscs]);

  const { winsP1, winsP2, draws, totalMeets } = useMemo(() => {
    let w1 = 0, w2 = 0, d = 0;
    for (const meets of commonMeetsByDisc.values())
      for (const { m1, m2 } of meets) {
        if (m1.qualTotal > m2.qualTotal) w1++;
        else if (m2.qualTotal > m1.qualTotal) w2++;
        else d++;
      }
    return { winsP1: w1, winsP2: w2, draws: d, totalMeets: w1 + w2 + d };
  }, [commonMeetsByDisc]);

  const handleClear = (which: "p1" | "p2") => {
    if (which === "p1") { setP1(null); initialP1Ref.current = undefined; }
    else { setP2(null); initialP2Ref.current = undefined; }
    setData(null);
  };

  const swap = () => {
    const a = p1; const b = p2;
    const aRef = initialP1Ref.current; initialP1Ref.current = initialP2Ref.current; initialP2Ref.current = aRef;
    setP1(b); setP2(a);
    if (data) setData({ ...data, p1: data.p2, p2: data.p1 });
  };

  // ShooterInlineSearch calls onChange with id=-1 as a clear signal
  const handleP1Change = (s: ShooterOption) => s.id === -1 ? handleClear("p1") : setP1(s);
  const handleP2Change = (s: ShooterOption) => s.id === -1 ? handleClear("p2") : setP2(s);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Pickers */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-4 border-b border-[var(--border)]">
        <ShooterInlineSearch
          value={p1}
          onChange={handleP1Change}
          excludeId={p2Id}
          placeholder={labels.h2hPickPrompt}
          label="Strelac A"
        />
        <button
          type="button"
          onClick={swap}
          disabled={!p1Id && !p2Id}
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0 self-end mb-[3px]"
          aria-label={labels.h2hSwap}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 5h10M9 2l3 3-3 3M12 9H2M5 6L2 9l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <ShooterInlineSearch
          value={p2}
          onChange={handleP2Change}
          excludeId={p1Id}
          placeholder={labels.h2hPickPrompt}
          label="Strelac B"
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-5 h-5 border-2 border-[var(--border)] border-t-[var(--brand-primary)] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="py-16 text-center px-5">
          <p className="text-sm text-[var(--muted)]">Greška pri učitavanju. Pokušaj ponovo.</p>
        </div>
      ) : !data ? (
        <div className="py-16 text-center px-5">
          <p className="text-sm text-[var(--muted)]">{labels.h2hPickBoth}</p>
        </div>
      ) : (
        <>
          {/* Shooter headers */}
          <div className="grid grid-cols-2 px-5 pt-4">
            <ShooterHeader shooter={data.p1} scopedHref={scopedHref} />
            <ShooterHeader shooter={data.p2} scopedHref={scopedHref} />
          </div>

          {/* H2H win bar */}
          {totalMeets > 0 && (
            <div className="mx-5 mb-2 flex h-5 overflow-hidden rounded text-center text-[10px] font-bold text-white">
              {winsP1 > 0 && <span className="flex items-center justify-center bg-[var(--brand-primary)]" style={{ width: `${(winsP1 / totalMeets) * 100}%` }}>{winsP1}</span>}
              {draws > 0 && <span className="flex items-center justify-center bg-[var(--subtle)]" style={{ width: `${(draws / totalMeets) * 100}%` }}>{draws}</span>}
              {winsP2 > 0 && <span className="flex items-center justify-center bg-[var(--brand-accent)]" style={{ width: `${(winsP2 / totalMeets) * 100}%` }}>{winsP2}</span>}
            </div>
          )}

          {/* Per-discipline stats */}
          {sharedDiscs.length === 0 ? (
            <div className="px-5 py-6 text-center border-t border-[var(--border)]">
              <p className="text-sm text-[var(--muted)]">Nema zajedničkih nastupa u istim disciplinama.</p>
            </div>
          ) : sharedDiscs.map((code) => {
            const s1 = data.p1.stats.find((s) => s.disciplineCode === code) ?? null;
            const s2 = data.p2.stats.find((s) => s.disciplineCode === code) ?? null;
            const meets = commonMeetsByDisc.get(code) ?? [];
            const isAP = code.startsWith("AP");
            return (
              <div key={code} className="border-t border-[var(--border)]">
                <div className="px-5 pt-4 pb-1 flex items-center gap-2">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--subtle)]">{code}</span>
                  {s1?.trend && <span className="text-xs text-[var(--muted)]">{trendLabel(s1.trend as Trend)}</span>}
                </div>
                <div className="px-5 pb-2">
                  <StatRow label={labels.h2hStat_forma} v1={s1?.forma ?? null} v2={s2?.forma ?? null} />
                  <StatRow label={labels.h2hStat_peak} v1={s1?.peak ?? null} v2={s2?.peak ?? null} />
                  <StatRow label={labels.h2hStat_best3} v1={s1?.best3avg ?? null} v2={s2?.best3avg ?? null} />
                  <StatRow label={`${labels.h2hStat_seasonAvg} · ${data.seasonLabel}`} v1={s1?.seasonAvg ?? null} v2={s2?.seasonAvg ?? null} />
                  <StatRow label={labels.h2hStat_recent3} v1={s1?.recent3avg ?? null} v2={s2?.recent3avg ?? null} />
                  <StatRow label={labels.h2hStat_appearances} v1={s1?.appearances ?? null} v2={s2?.appearances ?? null} />
                </div>

                <div className="border-t border-[var(--border)] px-5 py-4">
                  <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">{labels.h2hCommonMeets}</h4>
                  {meets.length === 0 ? (
                    <p className="text-xs text-[var(--subtle)]">{labels.h2hNoCommonMeets}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {meets.map(({ m1, m2 }) => {
                        const p1Better = m1.qualTotal > m2.qualTotal;
                        const p2Better = m2.qualTotal > m1.qualTotal;
                        return (
                          <div key={m1.competitionId} className="flex items-center gap-3 py-1.5 text-xs">
                            <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums w-14 text-right" style={{ color: p1Better ? "var(--brand-primary)" : "var(--muted)" }}>
                              {m1.qualTotal.toFixed(isAP ? 0 : 1)}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-[var(--muted)] text-center" title={m1.competitionName}>
                              {m1.competitionName}
                              <span className="text-[var(--subtle)]"> · {m1.date}</span>
                            </span>
                            <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums w-14" style={{ color: p2Better ? "var(--brand-primary)" : "var(--muted)" }}>
                              {m2.qualTotal.toFixed(isAP ? 0 : 1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
