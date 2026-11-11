export const revalidate = 86400;

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ScopedLink } from "../../components/ScopedLink";
import { OlympicRings } from "@/components/result-display/OlympicQuotaBadge";
import { NOC_LIST } from "@shootermarkt/db/noc-list";
import { pageParams } from "@/i18n/page-params";
import { buildAlternates } from "@/i18n/alternates";
import { LEVEL_STYLE, getLevelLabel } from "@/lib/competition-utils";
import { getQuotaOverview, type QuotaCompetition } from "@/lib/olympic-quotas";
import type { Scope } from "@/lib/scope";

type Props = { params: Promise<{ locale: string; scope: Scope }> };

const TEXT = {
  sr: {
    title: "Olimpijske kvote · LA 2028",
    lead: (awarded: number, places: number) => `Dodeljeno ${awarded} od ${places} mesta na takmičenjima koja smo uneli.`,
    note: "Kvota formalno pripada nacionalnom olimpijskom komitetu (NOC). Zvanična lista je ISSF-ova; ovo je nezvaničan pregled.",
    serbia: "Srbija",
    serbiaNone: "Srbija još nema osvojenu kvotu.",
    competitions: "Takmičenja koja dele kvote",
    disciplines: "Po disciplinama",
    open: "Otvoreno",
    empty: "Podela kvota još nije uneta.",
    places: "mesta",
  },
  en: {
    title: "Olympic quotas · LA 2028",
    lead: (awarded: number, places: number) => `${awarded} of ${places} places awarded at the competitions we track.`,
    note: "A quota place formally belongs to the National Olympic Committee (NOC). The official list is ISSF's; this is an unofficial overview.",
    serbia: "Serbia",
    serbiaNone: "Serbia has not won a quota place yet.",
    competitions: "Competitions awarding quotas",
    disciplines: "By discipline",
    open: "Open",
    empty: "No quota allocation has been entered yet.",
    places: "places",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scope } = await pageParams(params);
  const locale = await getLocale();
  return { title: TEXT[locale === "en" ? "en" : "sr"].title, alternates: buildAlternates(locale, scope, "/olimpijske-igre") };
}

const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}.`; };
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

function NocFlag({ nationality }: { nationality: string | null }) {
  const entry = NOC_LIST.find((n) => n.noc === nationality);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[var(--ink)] ${MONO}`}>
      {entry && <span className={`fi fi-${entry.alpha2.toLowerCase()}`} style={{ width: 14, height: 10, borderRadius: 1, display: "inline-block" }} />}
      {nationality ?? "—"}
    </span>
  );
}

function competitionName(c: Pick<QuotaCompetition, "name" | "nameSr" | "nameEn">, en: boolean) {
  return en ? (c.nameEn ?? c.name) : (c.nameSr ?? c.name);
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold uppercase text-[var(--ink)]" style={{ letterSpacing: "-0.02em" }}>
      {children}
    </h2>
  );
}

export default async function OlympicQuotasPage({ params }: Props) {
  const { scope } = await pageParams(params);
  const locale = await getLocale();
  const en = locale === "en";
  const t = TEXT[en ? "en" : "sr"];
  const overview = await getQuotaOverview();
  const byId = new Map(overview.competitions.map((c) => [c.id, c]));
  const today = new Date().toISOString().slice(0, 10);

  const serbian = overview.disciplines.flatMap((d) =>
    d.slots.flatMap((s) => (s.holder?.nationality === "SRB" ? [{ code: d.code, holder: s.holder, competition: byId.get(s.competitionId)! }] : []))
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8 border-b border-[var(--border)] pb-6">
        <h1
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.875rem, 5vw, 2.5rem)", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          <OlympicRings height={28} />
          {t.title}
        </h1>
        {overview.places > 0 && <p className="text-base text-[var(--ink)]">{t.lead(overview.awarded, overview.places)}</p>}
        <p className="mt-1 max-w-[65ch] text-sm text-[var(--muted)]">{t.note}</p>
      </header>

      {overview.competitions.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center text-sm text-[var(--muted)]">{t.empty}</p>
      ) : (
        <>
          {scope === "srb" && (
            <section className="mb-10" aria-labelledby="serbia-quotas">
              <h2 id="serbia-quotas" className="mb-4 flex items-center gap-2.5 font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold uppercase text-[var(--ink)]" style={{ letterSpacing: "-0.02em" }}>
                <NocFlag nationality="SRB" />
                {t.serbia}
                <span className={`text-lg text-[var(--muted)] ${MONO}`}>{serbian.length}</span>
              </h2>
              {serbian.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t.serbiaNone}</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                  {serbian.map((s) => (
                    <li key={`${s.holder.shooterId}-${s.code}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
                      <ScopedLink href={`/strelci/${s.holder.shooterId}`} className="font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
                        {s.holder.lastName} {s.holder.firstName}
                      </ScopedLink>
                      <span className={`text-xs font-semibold text-[var(--muted)] ${MONO}`}>{s.code}</span>
                      <ScopedLink href={`/takmicenja/${s.competition.id}`} className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                        {competitionName(s.competition, en)}
                      </ScopedLink>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="mb-10" aria-labelledby="quota-competitions">
            <SectionTitle id="quota-competitions">{t.competitions}</SectionTitle>
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {overview.competitions.map((c) => {
                const done = (c.dateEnd ?? c.date) < today;
                return (
                  <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums text-[var(--ink)] ${MONO}`}>{fmtDate(c.date)}</span>
                        <span className="rounded-md px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide" style={LEVEL_STYLE[c.level]}>{getLevelLabel(c.level, locale)}</span>
                      </div>
                      <ScopedLink href={`/takmicenja/${c.id}`} className="mt-1 block font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
                        {competitionName(c, en)}
                      </ScopedLink>
                      {c.location && <p className="text-sm text-[var(--muted)]">{c.location}</p>}
                    </div>
                    <ul className="flex flex-wrap gap-1.5" aria-label={t.places}>
                      {c.disciplines.map((d) => {
                        const full = d.awarded >= d.places;
                        return (
                          <li key={d.code} className={`rounded-md px-2 py-1 text-xs font-semibold tabular-nums ring-1 ${MONO} ${full ? "text-[var(--ink)] ring-[var(--success)]" : done ? "text-[var(--muted)] ring-[var(--border-strong)]" : "text-[var(--muted)] ring-[var(--border)]"}`}>
                            {d.code} {d.awarded}/{d.places}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="quota-disciplines">
            <SectionTitle id="quota-disciplines">{t.disciplines}</SectionTitle>
            <div className="grid gap-5 lg:grid-cols-2">
              {overview.disciplines.map((d) => (
                <div key={d.code} className="min-w-0 rounded-xl border border-[var(--border)]">
                  <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 rounded-t-xl">
                    <h3 className="text-sm font-semibold text-[var(--ink)]">
                      <span className={MONO}>{d.code}</span> <span className="font-normal text-[var(--muted)]">· {d.name}</span>
                    </h3>
                    <span className={`text-sm font-semibold tabular-nums text-[var(--ink)] ${MONO}`}>{d.awarded}/{d.places}</span>
                  </div>
                  <ul className="divide-y divide-[var(--border)]">
                    {d.slots.map((s, i) => {
                      const c = byId.get(s.competitionId)!;
                      return (
                        <li key={i} className="flex min-w-0 items-center gap-3 px-4 py-2.5 text-sm">
                          {s.holder ? (
                            <>
                              <NocFlag nationality={s.holder.nationality} />
                              <ScopedLink href={`/strelci/${s.holder.shooterId}`} className="min-w-0 shrink-0 max-w-[60%] truncate font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
                                {s.holder.lastName} {s.holder.firstName}
                              </ScopedLink>
                            </>
                          ) : (
                            <span className="text-[var(--muted)]">{t.open}</span>
                          )}
                          <ScopedLink href={`/takmicenja/${c.id}`} className="ml-auto min-w-0 shrink truncate text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                            {competitionName(c, en)}
                          </ScopedLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
