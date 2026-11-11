export const revalidate = 86400;

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ScopedLink } from "../../components/ScopedLink";
import { OlympicRings } from "@/components/result-display/OlympicQuotaBadge";
import { ShooterAvatar } from "@/components/result-display/ShooterAvatar";
import { QuotaTabs } from "./QuotaTabs";
import { NOC_LIST } from "@shootermarkt/db/noc-list";
import { disciplineName } from "@shootermarkt/db/discipline-names";
import { pageParams } from "@/i18n/page-params";
import { buildAlternates } from "@/i18n/alternates";
import { LEVEL_STYLE, getLevelLabel } from "@/lib/competition-utils";
import { MAX_QUOTAS_PER_NOC } from "@/lib/quota-assign";
import { getQuotaOverview, type QuotaHolder, type QuotaSlot, type QuotaSource, type QuotaSourceKind } from "@/lib/olympic-quotas";
import type { Scope } from "@/lib/scope";

type Props = { params: Promise<{ locale: string; scope: Scope }> };

// Olimpijske boje služe kao legenda izvora kvota (ova stranica ima svoj izgled, ostatak sajta ostaje neutralan).
const KIND_COLOR: Record<QuotaSourceKind, string> = {
  competition: "#0085C7",
  ranking: "#F4C300",
  host: "#009F3D",
  universality: "#DF0024",
};
const RING_COLORS = ["#0085C7", "#F4C300", "#111111", "#009F3D", "#DF0024"];

const TEXT = {
  sr: {
    title: "Olimpijske kvote · LA 2028",
    lead: "Put do Los Anđelesa: koliko kvota se deli, na kom takmičenju i ko ih je osvojio.",
    note: "Kvota formalno pripada nacionalnom olimpijskom komitetu (NOC). Ova lista je nezvaničnog karaktera.",
    cycle: "Ceo ciklus",
    awardedOf: (a: number, p: number) => `${a} od ${p} mesta dodeljeno`,
    kinds: { competition: "Takmičenja", ranking: "Olimpijska rang-lista", host: "Domaćin", universality: "Univerzalna mesta" } as Record<QuotaSourceKind, string>,
    kindNote: { ranking: "Dodeljuje se po rang-listi", host: "Mesta domaćina", universality: "Univerzalna mesta" } as Record<string, string>,
    serbia: "Srbija",
    serbiaNone: "Srbija još nema osvojenu kvotu.",
    path: "Put do LA 2028",
    pathNote: "Svaki red je izvor kvota. Klik na red otvara osvajače po disciplinama.",
    total: "Ukupno",
    disciplines: "Po disciplinama",
    countries: "Po državama",
    view: "Registar osvajača",
    openCompetition: "Otvori takmičenje",
    countriesNote: `Država može imati najviše ${MAX_QUOTAS_PER_NOC} kvote po disciplini.`,
    open: "Otvoreno",
    empty: "Podela kvota još nije uneta.",
    places: "mesta",
    finalPlace: "Mesto u finalu",
    qualPlace: "Mesto u kvalifikacijama",
    totalLabel: "ukupno",
    rankingClose: "Zaključenje liste",
  },
  en: {
    title: "Olympic quotas · LA 2028",
    lead: "The road to Los Angeles: how many quota places are awarded, where, and who won them.",
    note: "A quota place formally belongs to the National Olympic Committee (NOC). This list is unofficial.",
    cycle: "Whole cycle",
    awardedOf: (a: number, p: number) => `${a} of ${p} places awarded`,
    kinds: { competition: "Competitions", ranking: "Olympic ranking", host: "Host", universality: "Universality places" } as Record<QuotaSourceKind, string>,
    kindNote: { ranking: "Awarded by the ranking", host: "Host places", universality: "Universality places" } as Record<string, string>,
    serbia: "Serbia",
    serbiaNone: "Serbia has not won a quota place yet.",
    path: "Road to LA 2028",
    pathNote: "Each row is a source of quota places. Click a row to see who won them, by discipline.",
    total: "Total",
    disciplines: "By discipline",
    countries: "By country",
    view: "Quota winners",
    openCompetition: "Open competition",
    countriesNote: `A country can hold at most ${MAX_QUOTAS_PER_NOC} quota places per discipline.`,
    open: "Open",
    empty: "No quota allocation has been entered yet.",
    places: "places",
    finalPlace: "Place in the final",
    qualPlace: "Place in qualification",
    totalLabel: "total",
    rankingClose: "List closes",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scope } = await pageParams(params);
  const locale = await getLocale();
  return { title: TEXT[locale === "en" ? "en" : "sr"].title, alternates: buildAlternates(locale, scope, "/olimpijske-igre") };
}

const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}.`; };
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";
const DISPLAY = "font-[family-name:var(--font-barlow-condensed)]";

/** 3 položaja: naziv bez varijante (3x20/3x40), jer se format menjao i ne znamo ga za LA 2028. */
function disciplineLabel(code: string, en: boolean) {
  if (code === "R3PM" || code === "R3PW") {
    const base = en ? "50m Rifle 3 Positions" : "50m puška 3 položaja";
    const women = code === "R3PW";
    return en ? `${base} ${women ? "Women" : "Men"}` : `${base} – ${women ? "seniorke" : "seniori"}`;
  }
  return disciplineName(code, en ? "en" : "sr", { gender: true });
}

/** Naziv države na jeziku sajta; šifre bez države (npr. AIN) ostaju šifra. */
function countryLabel(nationality: string, en: boolean) {
  const entry = NOC_LIST.find((n) => n.noc === nationality);
  if (!entry || nationality === "AIN") return nationality;
  if (!en) return entry.name;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(entry.alpha2)?.replace(/\s*\(.*\)\s*$/, "") ?? nationality;
  } catch {
    return nationality;
  }
}

function NocFlag({ nationality }: { nationality: string | null }) {
  const entry = NOC_LIST.find((n) => n.noc === nationality);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[var(--ink)] ${MONO}`}>
      {entry && <span className={`fi fi-${entry.alpha2.toLowerCase()}`} style={{ width: 14, height: 10, borderRadius: 1, display: "inline-block" }} />}
      {nationality ?? "—"}
    </span>
  );
}

function SectionTitle({ id, children, note }: { id: string; children: ReactNode; note?: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className={`${DISPLAY} text-2xl font-bold uppercase text-[var(--ink)]`} style={{ letterSpacing: "-0.02em" }}>{children}</h2>
      {note && <p className="mt-1 text-sm text-[var(--muted)]">{note}</p>}
    </div>
  );
}

export default async function OlympicQuotasPage({ params }: Props) {
  const { scope } = await pageParams(params);
  const locale = await getLocale();
  const en = locale === "en";
  const t = TEXT[en ? "en" : "sr"];
  const overview = await getQuotaOverview();
  const sourceByKey = new Map(overview.sources.map((s) => [s.key, s]));
  const today = new Date().toISOString().slice(0, 10);
  const multiSource = overview.sources.length > 1;

  const place = (s: QuotaSource) => (en ? (s.locationEn ?? s.location) : (s.locationSr ?? s.location));
  const sourceName = (s: QuotaSource) => (s.kind === "competition" ? (en ? (s.nameEn ?? s.name) : (s.nameSr ?? s.name)) ?? "" : t.kinds[s.kind]);
  /** Izvor uvek sa mestom i godinom održavanja: "ISSF Svetsko prvenstvo Puška / Pištolj · Doha · 2026". */
  const sourceFull = (s: QuotaSource) => (s.kind === "competition" ? [sourceName(s), place(s), s.date?.slice(0, 4)].filter(Boolean).join(" · ") : sourceName(s));
  /** Kratko, za redove registra gde je ime strelca važnije: "Doha · 2026" (mesto i godina uvek ostaju). */
  const sourceShort = (s: QuotaSource) => (s.kind === "competition" ? [place(s), s.date?.slice(0, 4)].filter(Boolean).join(" · ") || sourceName(s) : sourceName(s));

  // Ukupno po vrsti izvora: za segmentiranu traku ciklusa.
  const byKind = (Object.keys(t.kinds) as QuotaSourceKind[])
    .map((kind) => {
      const list = overview.sources.filter((s) => s.kind === kind).flatMap((s) => s.disciplines);
      return { kind, places: list.reduce((n, d) => n + d.places, 0), awarded: list.reduce((n, d) => n + d.awarded, 0) };
    })
    .filter((k) => k.places > 0);

  const serbian = overview.disciplines.flatMap((d) =>
    d.slots.flatMap((s) => (s.holder?.nationality === "SRB" ? [{ code: d.code, slot: s, holder: s.holder }] : []))
  );

  const codes = overview.disciplines.map((d) => d.code);
  const gridCols = `minmax(0,1fr) repeat(${codes.length}, 3.5rem) 3.75rem`;

  function SlotMeta({ slot, holder, showSource }: { slot: QuotaSlot; holder?: QuotaHolder | null; showSource: boolean }) {
    const placeTitle = slot.basis === "qualification" ? t.qualPlace : t.finalPlace;
    const src = sourceByKey.get(slot.sourceKey);
    return (
      <span className="ml-auto flex min-w-0 shrink items-center gap-3">
        {showSource && src && (
          <span className="hidden min-w-0 truncate text-xs text-[var(--muted)] sm:block" title={sourceFull(src)}>{sourceShort(src)}</span>
        )}
        {holder?.rank != null && (
          <span title={placeTitle} aria-label={`${placeTitle}: ${holder.rank}`} className={`shrink-0 text-xs font-semibold tabular-nums text-[var(--muted)] ${MONO}`}>
            #{holder.rank}
          </span>
        )}
      </span>
    );
  }

  /** Mesta jedne discipline: avatar, država i ime osvajača, ili otvoreno mesto. */
  function DisciplineBlock({ code, awarded, places, slots, showSource }: { code: string; awarded: number; places: number; slots: QuotaSlot[]; showSource: boolean }) {
    return (
      <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]">
        <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">
            <span className={MONO}>{code}</span> <span className="font-normal text-[var(--muted)]">· {disciplineLabel(code, en)}</span>
          </h3>
          <span className={`shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)] ${MONO}`}>{awarded}/{places}</span>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {slots.map((s, i) => (
            <li key={i} className="flex min-w-0 items-center gap-3 px-4 py-2 text-sm">
              {s.holder ? (
                <>
                  <ShooterAvatar firstName={s.holder.firstName} lastName={s.holder.lastName} avatarUrl={s.holder.avatarUrl} />
                  <NocFlag nationality={s.holder.nationality} />
                  <ScopedLink href={`/strelci/${s.holder.shooterId}`} className="min-w-0 truncate font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
                    {s.holder.lastName} {s.holder.firstName}
                  </ScopedLink>
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full border border-dashed border-[var(--border-strong)]" />
                  <span className="text-[var(--muted)]">{t.open}</span>
                </>
              )}
              <SlotMeta slot={s} holder={s.holder} showSource={showSource} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /** Ćelija tabele: dodeljeno/mesta; obojena bojom izvora kad je popunjena. */
  function Cell({ d, color }: { d: { awarded: number; places: number } | undefined; color: string }) {
    if (!d) return <span aria-hidden="true" className="text-[var(--border-strong)]">·</span>;
    const full = d.awarded >= d.places;
    const style: CSSProperties | undefined = full ? { background: `color-mix(in oklch, ${color} 18%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined;
    return (
      <span style={style} className={`rounded-md px-1.5 py-1 text-xs font-semibold tabular-nums ${MONO} ${full ? "text-[var(--ink)]" : d.awarded > 0 ? "text-[var(--ink)] ring-1 ring-[var(--border-strong)]" : "text-[var(--muted)] ring-1 ring-[var(--border)]"}`}>
        {d.awarded}/{d.places}
      </span>
    );
  }

  const ledger = (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      {/* Zaglavlje kolona: discipline (samo desktop; na telefonu svaki red nosi svoje oznake) */}
      <div className="hidden items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:grid" style={{ gridTemplateColumns: gridCols }}>
        <span />
        {codes.map((c) => (
          <abbr key={c} title={disciplineLabel(c, en)} className={`text-center text-xs font-semibold text-[var(--muted)] no-underline ${MONO}`}>{c}</abbr>
        ))}
        <span className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t.total}</span>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {overview.sources.map((s) => {
          const color = KIND_COLOR[s.kind];
          const awarded = s.disciplines.reduce((n, d) => n + d.awarded, 0);
          const places = s.disciplines.reduce((n, d) => n + d.places, 0);
          const done = s.date != null && (s.dateEnd ?? s.date) < today;
          const dateLabel = s.date ? fmtDate(s.date) : null;
          return (
            <li key={s.key}>
              {/* Nativni <details>: bez JS-a; sa jednim izvorom je otvoren, sa više njih zatvoren. */}
              <details open={!multiSource} className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)] sm:items-center sm:gap-3 [&::-webkit-details-marker]:hidden sm:[grid-template-columns:var(--cols)]" style={{ "--cols": `auto ${gridCols}` } as CSSProperties}>
                  <span aria-hidden="true" className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90">
                      <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${done || s.kind !== "competition" ? "" : "bg-transparent ring-2"}`} style={done || s.kind !== "competition" ? { background: color } : { boxShadow: `inset 0 0 0 2px ${color}` }} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {dateLabel && <span className={`text-xs font-semibold tabular-nums text-[var(--muted)] ${MONO}`}>{dateLabel}</span>}
                      {s.kind === "competition" && s.level && (
                        <span className="rounded-md px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide" style={LEVEL_STYLE[s.level]}>{getLevelLabel(s.level, locale)}</span>
                      )}
                      {s.kind === "ranking" && <span className="text-xs text-[var(--muted)]">{t.rankingClose}</span>}
                    </div>
                    <p className="font-semibold text-[var(--ink)] [text-wrap:balance]">{sourceName(s)}</p>
                    {s.kind === "competition" && place(s) && <p className="text-sm text-[var(--muted)]">{place(s)} · {s.date?.slice(0, 4)}</p>}
                  </div>
                  {/* Telefon: ukupno + čipovi disciplina; desktop: poravnate ćelije po kolonama */}
                  <span className={`text-right text-sm font-bold tabular-nums text-[var(--ink)] sm:hidden ${MONO}`}>{awarded}/{places}</span>
                  <ul className="col-span-3 flex flex-wrap gap-1.5 sm:hidden" aria-label={t.places}>
                    {s.disciplines.map((d) => (
                      <li key={d.code} className="flex items-center gap-1.5 text-xs text-[var(--muted)]"><span className={MONO}>{d.code}</span><Cell d={d} color={color} /></li>
                    ))}
                  </ul>
                  {codes.map((c) => (
                    <span key={c} className="hidden justify-center sm:flex">
                      <Cell d={s.disciplines.find((d) => d.code === c)} color={color} />
                    </span>
                  ))}
                  <span className={`hidden text-center text-sm font-bold tabular-nums text-[var(--ink)] sm:block ${MONO}`}>{awarded}/{places}</span>
                </summary>
                <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {s.disciplines.map((d) => (
                      <DisciplineBlock key={d.code} code={d.code} awarded={d.awarded} places={d.places} slots={d.slots} showSource={false} />
                    ))}
                  </div>
                  {s.competitionId != null && (
                    <ScopedLink href={`/takmicenja/${s.competitionId}`} className="mt-4 inline-block text-sm font-semibold text-[var(--brand-primary)] hover:underline">
                      {t.openCompetition} →
                    </ScopedLink>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      {/* Zbir po disciplinama za ceo ciklus */}
      <div className="hidden items-center gap-3 border-t-2 border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 sm:grid" style={{ gridTemplateColumns: gridCols }}>
        <span className="text-sm font-semibold uppercase tracking-wide text-[var(--ink)]">{t.cycle}</span>
        {overview.disciplines.map((d) => (
          <span key={d.code} className={`text-center text-xs font-bold tabular-nums text-[var(--ink)] ${MONO}`}>{d.awarded}/{d.places}</span>
        ))}
        <span className={`text-center text-sm font-bold tabular-nums text-[var(--ink)] ${MONO}`}>{overview.awarded}/{overview.places}</span>
      </div>
    </div>
  );

  const disciplinesPanel = (
    <div className="grid gap-4 lg:grid-cols-2">
      {overview.disciplines.map((d) => (
        <DisciplineBlock key={d.code} code={d.code} awarded={d.awarded} places={d.places} slots={d.slots} showSource={multiSource} />
      ))}
    </div>
  );

  const countriesPanel = (
    <>
      <p className="mb-4 text-sm text-[var(--muted)]">{t.countriesNote}</p>
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
        {overview.countries.map((c) => (
          <li key={c.nationality} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <NocFlag nationality={c.nationality} />
              <span className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">{countryLabel(c.nationality, en)}</span>
              <span className={`shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)] ${MONO}`} aria-label={`${c.total} ${t.totalLabel}`}>{c.total}</span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {c.byDiscipline.map((d) => (
                <li key={d.code} className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${MONO} ${d.count >= MAX_QUOTAS_PER_NOC ? "text-[var(--ink)] ring-[var(--ink)]" : "text-[var(--muted)] ring-[var(--border-strong)]"}`}>
                  {d.code}{d.count > 1 ? ` ×${d.count}` : ""}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div>
      {/* Hero: svoj svet stranice. Fiksno tamna podloga u obe teme; --ink se prepisuje da tekst i crni krug budu svetli. */}
      <section
        className="relative text-white"
        style={{ background: "oklch(0.19 0.02 265)", ["--ink" as string]: "oklch(0.98 0 0)", ["--muted" as string]: "oklch(0.78 0.01 265)" } as CSSProperties}
        aria-labelledby="olympic-title"
      >
        <div aria-hidden="true" className="flex h-1.5 w-full">
          {RING_COLORS.map((c) => <span key={c} className="flex-1" style={{ background: c === "#111111" ? "oklch(0.98 0 0)" : c }} />)}
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-9 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <OlympicRings height={34} />
            <h1 id="olympic-title" className={`${DISPLAY} font-extrabold uppercase`} style={{ fontSize: "clamp(2rem, 6vw, 3.25rem)", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
              {t.title}
            </h1>
          </div>
          <p className="mt-3 max-w-[60ch] text-base text-[var(--muted)]">{t.lead}</p>

          {byKind.length > 0 && (
            <div className="mt-8" role="img" aria-label={t.awardedOf(overview.awarded, overview.places)}>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <span className={`${DISPLAY} text-lg font-bold uppercase`}>{t.cycle}</span>
                <span className={`text-sm tabular-nums ${MONO}`}>{t.awardedOf(overview.awarded, overview.places)}</span>
              </div>
              {/* Segmentirana traka: širina = broj mesta izvora, popunjeno = dodeljeno. */}
              <div className="flex gap-1">
                {byKind.map((k) => (
                  <div key={k.kind} className="h-4 overflow-hidden rounded-sm" style={{ flexGrow: k.places, flexBasis: 0, background: `color-mix(in oklch, ${KIND_COLOR[k.kind]} 28%, transparent)` }}>
                    <div className="h-full" style={{ width: `${(k.awarded / k.places) * 100}%`, background: KIND_COLOR[k.kind] }} />
                  </div>
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                {byKind.map((k) => (
                  <li key={k.kind} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k.kind] }} />
                    <span>{t.kinds[k.kind]}</span>
                    <span className={`tabular-nums text-[var(--muted)] ${MONO}`}>{k.awarded}/{k.places}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-6 max-w-[65ch] text-xs text-[var(--muted)]">{t.note}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {overview.sources.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center text-sm text-[var(--muted)]">{t.empty}</p>
        ) : (
          <>
            {scope === "srb" && (
              <section className="mb-12" aria-labelledby="serbia-quotas">
                <SectionTitle id="serbia-quotas">
                  <span className="inline-flex items-center gap-2.5"><NocFlag nationality="SRB" />{t.serbia} <span className={`text-lg font-normal text-[var(--muted)] ${MONO}`}>{serbian.length}</span></span>
                </SectionTitle>
                {serbian.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">{t.serbiaNone}</p>
                ) : (
                  <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                    {serbian.map(({ code, slot, holder }) => {
                      const src = sourceByKey.get(slot.sourceKey)!;
                      return (
                        <li key={`${holder.shooterId}-${code}`} className="flex min-w-0 items-center gap-3 px-4 py-3">
                          <ShooterAvatar firstName={holder.firstName} lastName={holder.lastName} avatarUrl={holder.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <ScopedLink href={`/strelci/${holder.shooterId}`} className="block truncate font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
                              {holder.lastName} {holder.firstName}
                            </ScopedLink>
                            <p className="truncate text-sm text-[var(--muted)]"><span className={`text-xs font-semibold ${MONO}`}>{code}</span> · {disciplineLabel(code, en)}</p>
                            {/* Izvor kvote: takmičenje uvek sa mestom i godinom. */}
                            <p className="truncate text-sm text-[var(--muted)]">{sourceFull(src)}</p>
                          </div>
                          {holder.rank != null && (
                            <span className={`ml-auto shrink-0 text-xs font-semibold tabular-nums text-[var(--muted)] ${MONO}`} title={slot.basis === "qualification" ? t.qualPlace : t.finalPlace}>#{holder.rank}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            <section className="mb-12" aria-labelledby="quota-path">
              <SectionTitle id="quota-path" note={t.pathNote}>{t.path}</SectionTitle>
              {ledger}
            </section>

            <QuotaTabs
              label={t.view}
              tabs={[
                { id: "disciplines", label: t.disciplines, count: overview.disciplines.length },
                { id: "countries", label: t.countries, count: overview.countries.length },
              ]}
              panels={{ disciplines: disciplinesPanel, countries: countriesPanel }}
            />
          </>
        )}
      </div>
    </div>
  );
}
