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
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${path}?scope=${scope ?? "srb"}&locale=${locale}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then(setData).catch(() => setData(null));
    return () => controller.abort();
  }, [locale, path, scope]);
  return data;
}

export function HomepageTickerClient() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const data = useHomepageData<{ live: Array<{ id: number; name: string; date: string; level: string; best: { lastName: string; qualTotal: string; discCode: string } | null; nocCode: string | null; countryCode2: string | null }>; upcoming: Array<{ id: number; name: string; date: string; level: string; location: string | null }> }>("/api/homepage/ticker");
  if (!data) return <div className="h-10 animate-pulse bg-[var(--surface)]" />;
  const liveItems: TickerItem[] = data.live.map((item) => ({ id: item.id, name: item.name, date: item.date, level: item.level, status: "LIVE", detailText: item.best ? `1. ${item.best.lastName} ${Number(item.best.qualTotal).toFixed(item.best.discCode.startsWith("AP") ? 0 : 1)}` : t("inProgress"), href: `/takmicenja/${item.id}`, nocCode: item.nocCode ?? undefined, countryCode2: item.countryCode2 ?? undefined }));
  const upcomingItems: TickerItem[] = data.upcoming.map((item) => ({ id: item.id, name: item.name, date: item.date, level: item.level, status: "USKORO", detailText: item.location || common("serbia"), href: `/takmicenja/${item.id}` }));
  return <Ticker liveItems={liveItems} upcomingItems={upcomingItems} />;
}

export function HomepageMainClient() {
  const locale = useLocale();
  const t = useTranslations("home");
  const tComp = useTranslations("competition");
  const data = useHomepageData<{ recent: Array<{ id: number; name: string; nameSr: string | null; nameEn: string | null; date: string; location: string | null; level: string; winner: { firstName: string; lastName: string; qualTotal: string; discCode: string } | null }>; upcoming: Array<{ id: number; name: string; nameSr: string | null; nameEn: string | null; date: string; location: string | null; level: string }>; topForma: Record<string, unknown[]> }>("/api/homepage/main");
  if (!data) return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
  const upcoming = data.upcoming.map((item) => ({ ...item, name: locale === "en" ? (item.nameEn ?? item.name) : (item.nameSr ?? item.name) }));
  return <><UpcomingEvents competitions={upcoming} /><section className="mt-8 flex flex-col gap-4"><div className="flex items-baseline justify-between"><h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider">{t("recentCompetitions")}</h2><ScopedLink href="/takmicenja" className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">{t("allCompsLink")}</ScopedLink></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{data.recent.map((item) => { const name = locale === "en" ? (item.nameEn ?? item.name) : (item.nameSr ?? item.name); const levelKey = `levels.${item.level.toLowerCase()}`; return <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4"><p className="text-[9px] font-bold uppercase text-[var(--muted)]">{tComp.has(levelKey) ? tComp(levelKey) : item.level}</p><h3 className="mt-1 truncate text-xs font-semibold">{name}</h3><p className="mt-3 text-xs text-[var(--muted)]">{item.date.split("-").reverse().join(".")} · {item.location || "—"}</p><div className="mt-3 border-t border-[var(--border)] pt-2 text-xs">{item.winner ? <><span className="font-semibold">{item.winner.lastName} {item.winner.firstName}</span><span className="float-right font-mono font-bold text-[var(--brand-primary)]">{Number(item.winner.qualTotal).toFixed(item.winner.discCode.startsWith("AP") ? 0 : 1)}</span></> : <span className="italic text-[var(--muted)]">{tComp("detail.noResults")}</span>}</div></div>; })}</div></section><section className="mt-8"><TopFormaClient initialData={data.topForma as never} /></section></>;
}

export function HomepageClubsClient() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const data = useHomepageData<Array<{ clubId: number; name: string; city: string | null; avgPct: number; activeShooters: number }>>("/api/homepage/clubs");
  if (!data) return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden"><div className="bg-[var(--brand-primary)] px-4 py-3"><h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase">{t("clubLeaderboard")}</h3></div><div className="p-4">{data.length === 0 ? <p className="py-4 text-center text-xs text-[var(--muted)]">{t("noClubData")}</p> : data.map((club, index) => <div key={club.clubId} className="flex items-center justify-between py-1.5 text-xs"><span><b className="mr-3 text-[var(--subtle)]">{index + 1}</b><b>{club.name}</b> <span className="text-[var(--muted)]">{club.city || common("serbia")}</span></span><span className="font-mono font-bold">{club.avgPct.toFixed(1)}%</span></div>)}</div></section>;
}
