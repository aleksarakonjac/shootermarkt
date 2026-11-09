"use client";

import { Link } from "@/i18n/navigation";
import type { EscSoloPart, FinalDetail, QualDetail } from "@shootermarkt/db/schema";
import type { RemarkDetails } from "@shootermarkt/db/pdf-import-types";
import { displayNoc } from "@shootermarkt/db/noc-list";
import { NOC_LIST } from "@/components/ui/NocDropdown";

export type EscSoloRow = {
  id: number;
  shooterId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  qualTotal: string | null;
  qualRank: number | null;
  qualDetail: QualDetail | null;
  finalTotal: string | null;
  finalRank: number | null;
  finalDetail: FinalDetail | null;
  remarkDetails: RemarkDetails | null;
};

const MEDAL_COLOR: Record<number, string> = { 1: "oklch(0.75 0.14 85)", 2: "oklch(0.75 0.01 85)", 3: "oklch(0.60 0.10 55)" };

const soloParts = (r: EscSoloRow) => (r.qualDetail && "format" in r.qualDetail ? r.qualDetail : null);
const matchOpponent = (r: EscSoloRow) => (r.finalDetail && "opponentTotal" in r.finalDetail ? r.finalDetail.opponentTotal ?? null : null);
const hits = (v: string | null) => (v == null ? "—" : String(Math.round(parseFloat(v))));

function Shooter({ r }: { r: EscSoloRow }) {
  const noc = r.nationality ? displayNoc(r.nationality) : null;
  const alpha2 = noc ? NOC_LIST.find((n) => n.noc === noc)?.alpha2 : null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {noc && (
        <span className="flex shrink-0 items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold text-[var(--ink)]">
          {alpha2 && <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ width: 14, height: 10, borderRadius: 1, display: "inline-block" }} />}
          {noc}
        </span>
      )}
      <Link href={`/strelci/${r.shooterId}`} className="min-w-0 truncate text-[var(--ink)] hover:text-[var(--brand-primary)]">
        <span className="font-medium">{r.lastName}</span> <span className="text-[var(--muted)]">{r.firstName}</span>
      </Link>
    </span>
  );
}

function Match({ rows, testId, title }: { rows: EscSoloRow[]; testId: string; title: string }) {
  const [winner, loser] = [...rows].sort((a, b) => (a.finalRank ?? 9) - (b.finalRank ?? 9));
  if (!winner) return null;
  const shootOff = winner.remarkDetails?.final?.shootOff ?? loser?.remarkDetails?.final?.shootOff;
  return (
    <div data-testid={testId} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
        {[winner, loser].filter(Boolean).map((r, i) => (
          <div key={r!.id} className="contents">
            <span className="flex min-w-0 items-center gap-2">
              {r!.finalRank != null && MEDAL_COLOR[r!.finalRank] && <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold text-white" style={{ background: MEDAL_COLOR[r!.finalRank] }}>{r!.finalRank}</span>}
              <span className={i === 0 ? "min-w-0 font-semibold" : "min-w-0"}><Shooter r={r!} /></span>
            </span>
            {i === 0 && (
              <span className="row-span-2 font-[family-name:var(--font-jetbrains-mono)] text-lg font-bold tabular-nums text-[var(--ink)]">
                {`${hits(winner.finalTotal)} : ${loser ? hits(loser.finalTotal) : matchOpponent(winner) ?? "—"}`}{shootOff ? " SO" : ""}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QualTable({ rows, part, testId, title, seriesCount, locale }: { rows: EscSoloRow[]; part: "part1" | "part2"; testId: string; title: string; seriesCount: number; locale: string }) {
  const th = "px-2 py-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-3";
  const td = "px-2 py-2 font-[family-name:var(--font-jetbrains-mono)] tabular-nums sm:px-3";
  const withPart = rows
    .map((r) => ({ r, p: soloParts(r)?.[part] as EscSoloPart | undefined }))
    .filter((x): x is { r: EscSoloRow; p: EscSoloPart } => x.p != null)
    .sort((a, b) => (a.p.rank ?? 999) - (b.p.rank ?? 999));
  if (withPart.length === 0) return null;
  return (
    <section className="space-y-2">
      <h4 className="font-[family-name:var(--font-barlow-condensed)] text-base font-bold uppercase text-[var(--ink)]">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table data-testid={testId} className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
            <th className={`${th} w-10 text-right`}>#</th>
            <th className={`${th} text-left`}>{locale === "en" ? "Athlete" : "Strelac"}</th>
            <th className={`${th} hidden text-left sm:table-cell`}>{locale === "en" ? "Series" : "Serije"}</th>
            <th className={`${th} text-right`}>{locale === "en" ? "Hits" : "Pogoci"}</th>
            <th className={`${th} w-12`} />
          </tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {withPart.map(({ r, p }) => (
              <tr key={r.id}>
                <td className={`${td} text-right text-[var(--muted)]`}>{p.rank ?? "—"}</td>
                <td className="min-w-0 max-w-0 px-2 py-2 sm:px-3"><Shooter r={r} /></td>
                <td className={`${td} hidden text-[var(--muted)] sm:table-cell`}>
                  <span className="flex gap-2">{Array.from({ length: seriesCount }, (_, i) => <span key={i} className="w-5 text-right">{p.series[i] ?? ""}</span>)}</span>
                </td>
                <td className={`${td} text-right font-semibold text-[var(--ink)]`}>{p.total ?? "—"}</td>
                <td className={`${td} text-[0.7rem] font-bold text-[var(--brand-primary)]`}>{p.remark ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** ESC Challenge Solo: mečevi za medalju, kvalifikacija 2, kvalifikacija 1 (pogoci, celi brojevi). */
export function EscSoloResults({ results, disciplineCode, locale }: { results: EscSoloRow[]; disciplineCode: string; locale: string }) {
  const en = locale === "en";
  const threshold = disciplineCode.startsWith("SOLOAP") ? "9.8" : "10.3";
  const gold = results.filter((r) => r.finalRank === 1 || r.finalRank === 2);
  const bronze = results.filter((r) => r.finalRank === 3 || r.finalRank === 4);
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">{en ? `Hit: ${threshold} or higher` : `Pogodak: ${threshold} i više`}</p>
      {(gold.length > 0 || bronze.length > 0) && (
        <section className="space-y-2">
          <h4 className="font-[family-name:var(--font-barlow-condensed)] text-base font-bold uppercase text-[var(--ink)]">{en ? "Medal matches" : "Mečevi za medalju"}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Match rows={gold} testId="gold-match" title={en ? "Gold" : "Zlato"} />
            <Match rows={bronze} testId="bronze-match" title={en ? "Bronze" : "Bronza"} />
          </div>
        </section>
      )}
      <QualTable rows={results} part="part2" testId="qual2" title={en ? "Qualification 2" : "Kvalifikacija 2"} seriesCount={6} locale={locale} />
      <QualTable rows={results} part="part1" testId="qual1" title={en ? "Qualification 1" : "Kvalifikacija 1"} seriesCount={3} locale={locale} />
    </div>
  );
}
