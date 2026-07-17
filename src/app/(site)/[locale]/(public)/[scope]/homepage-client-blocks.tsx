"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Ticker, type TickerItem } from "../ticker";
import { UpcomingEvents } from "../components/UpcomingEvents";
import { ScopedLink } from "../components/ScopedLink";
import { TopFormaClient } from "./top-forma-client";

function useHomepageData<T>(path: string) {
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${path}?scope=${scope ?? "srb"}&locale=${locale}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Homepage request failed")))
      .then((result) => { setData(result); setState("ready"); })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [attempt, locale, path, scope]);

  const retry = () => {
    setState("loading");
    setAttempt((value) => value + 1);
  };

  return { data, state, retry };
}

function HomepageError({ retry, compact = false }: { retry: () => void; compact?: boolean }) {
  const common = useTranslations("common");
  return (
    <div className={compact ? "flex h-10 items-center justify-center gap-3 bg-[var(--surface)] text-xs" : "flex h-48 flex-col items-center justify-center gap-3 rounded-xl bg-[var(--surface)] text-sm"} role="alert">
      <span className="text-[var(--muted)]">{common("error")}</span>
      <button type="button" onClick={retry} className="font-semibold text-[var(--brand-primary)] hover:underline">
        {common("retry")}
      </button>
    </div>
  );
}

export function HomepageTickerClient() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const { data, state, retry } = useHomepageData<{ live: Array<{ id: number; name: string; date: string; level: string; best: { lastName: string; qualTotal: string; discCode: string } | null; nocCode: string | null; countryCode2: string | null }>; upcoming: Array<{ id: number; name: string; date: string; level: string; location: string | null }> }>("/api/homepage/ticker");
  if (state === "loading") return <div aria-busy="true" className="h-10 animate-pulse bg-[var(--surface)]" />;
  if (state === "error" || !data) return <HomepageError retry={retry} compact />;

  const liveItems: TickerItem[] = data.live.map((item) => ({ id: item.id, name: item.name, date: item.date, level: item.level, status: "LIVE", detailText: item.best ? `1. ${item.best.lastName} ${Number(item.best.qualTotal).toFixed(item.best.discCode.startsWith("AP") ? 0 : 1)}` : t("inProgress"), href: `/takmicenja/${item.id}`, nocCode: item.nocCode ?? undefined, countryCode2: item.countryCode2 ?? undefined }));
  const upcomingItems: TickerItem[] = data.upcoming.map((item) => ({ id: item.id, name: item.name, date: item.date, level: item.level, status: "USKORO", detailText: item.location || common("serbia"), href: `/takmicenja/${item.id}` }));
  return <Ticker liveItems={liveItems} upcomingItems={upcomingItems} />;
}

export function HomepageMainClient() {
  const locale = useLocale();
  const t = useTranslations("home");
  const tComp = useTranslations("competition");
  const { data, state, retry } = useHomepageData<{ recent: Array<{ id: number; name: string; nameSr: string | null; nameEn: string | null; date: string; location: string | null; level: string; winner: { firstName: string; lastName: string; qualTotal: string; discCode: string } | null }>; upcoming: Array<{ id: number; name: string; nameSr: string | null; nameEn: string | null; date: string; location: string | null; level: string }>; topForma: Record<string, unknown[]> }>("/api/homepage/main");
  if (state === "loading") return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
  if (state === "error" || !data) return <HomepageError retry={retry} />;

  const upcoming = data.upcoming.map((item) => ({ ...item, name: locale === "en" ? (item.nameEn ?? item.name) : (item.nameSr ?? item.name) }));
  const [lead, ...recent] = data.recent;
  return <>
    <UpcomingEvents competitions={upcoming} />
    <section className="mt-8 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-xl font-bold uppercase tracking-wider">{t("recentCompetitions")}</h2>
        <ScopedLink href="/takmicenja" className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">{t("allCompsLink")}</ScopedLink>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {lead ? (() => {
          const name = locale === "en" ? (lead.nameEn ?? lead.name) : (lead.nameSr ?? lead.name);
          const levelKey = `levels.${lead.level.toLowerCase()}`;
          return <ScopedLink href={`/takmicenja/${lead.id}`} className="group flex min-h-52 flex-col justify-between rounded-xl border border-[var(--border-strong)] bg-[var(--bg)] p-5 transition-colors hover:border-[var(--brand-primary)] md:col-span-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">{t("winner")}</span>
                <span className="text-xs font-bold uppercase text-[var(--muted)]">{tComp.has(levelKey) ? tComp(levelKey) : lead.level}</span>
              </div>
              <h3 className="mt-3 text-balance font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold uppercase leading-tight group-hover:text-[var(--brand-primary)]">{name}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{lead.date.split("-").reverse().join(".")} · {lead.location || "—"}</p>
            </div>
            <div className="mt-6 flex items-end justify-between gap-4 border-t border-[var(--border)] pt-3">
              {lead.winner ? <div className="min-w-0"><p className="truncate text-sm font-semibold">{lead.winner.lastName} {lead.winner.firstName} <span className="font-mono text-[var(--muted)]">· {lead.winner.discCode}</span></p></div> : <p className="text-sm italic text-[var(--muted)]">{t("noWinner")}</p>}
              {lead.winner && <span className="shrink-0 font-mono text-3xl font-bold tracking-tight text-[var(--brand-primary)]">{Number(lead.winner.qualTotal).toFixed(lead.winner.discCode.startsWith("AP") ? 0 : 1)}</span>}
            </div>
            <span className="mt-4 text-sm font-semibold text-[var(--brand-primary)] group-hover:underline">{t("viewResults")} →</span>
          </ScopedLink>;
        })() : <p className="py-8 text-sm text-[var(--muted)] md:col-span-3">{t("noRecentComps")}</p>}
        {recent.map((item) => {
          const name = locale === "en" ? (item.nameEn ?? item.name) : (item.nameSr ?? item.name);
          const levelKey = `levels.${item.level.toLowerCase()}`;
          return <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--muted)]">{tComp.has(levelKey) ? tComp(levelKey) : item.level}</p>
            <h3 className="mt-1 truncate text-sm font-semibold">{name}</h3>
            <p className="mt-3 text-sm text-[var(--muted)]">{item.date.split("-").reverse().join(".")} · {item.location || "—"}</p>
            <div className="mt-3 border-t border-[var(--border)] pt-2 text-sm">{item.winner ? <><span className="font-semibold">{item.winner.lastName} {item.winner.firstName}</span><span className="float-right font-mono font-bold text-[var(--brand-primary)]">{Number(item.winner.qualTotal).toFixed(item.winner.discCode.startsWith("AP") ? 0 : 1)}</span></> : <span className="italic text-[var(--muted)]">{tComp("detail.noResults")}</span>}</div>
          </div>;
        })}
      </div>
    </section>
    <section className="mt-8"><TopFormaClient initialData={data.topForma as never} /></section>
  </>;
}

export function HomepageClubsClient() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const { data, state, retry } = useHomepageData<Array<{ clubId: number; name: string; city: string | null; avgPct: number; activeShooters: number }>>("/api/homepage/clubs");
  if (state === "loading") return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
  if (state === "error" || !data) return <HomepageError retry={retry} />;
  return <section className="overflow-hidden rounded-xl border border-t-2 border-[var(--border)] border-t-[var(--brand-primary)] bg-[var(--bg)]"><div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3"><h3 className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold uppercase text-[var(--brand-primary)]">{t("clubLeaderboard")}</h3></div><div className="p-4">{data.length === 0 ? <p className="py-4 text-center text-sm text-[var(--muted)]">{t("noClubData")}</p> : data.map((club, index) => <div key={club.clubId} className="flex items-center justify-between py-2 text-sm"><span><b className="mr-3 text-[var(--subtle)]">{index + 1}</b><b>{club.name}</b> <span className="text-[var(--muted)]">{club.city || common("serbia")}</span></span><span className="font-mono font-bold">{club.avgPct.toFixed(1)}%</span></div>)}</div></section>;
}
