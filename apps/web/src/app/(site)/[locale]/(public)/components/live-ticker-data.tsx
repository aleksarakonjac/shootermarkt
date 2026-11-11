"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import type { TickerItem } from "../ticker";

/**
 * Jedan izvor podataka za ticker na celom javnom sajtu: sticky traka u header-u
 * (kad je nešto LIVE) i marquee nadolazećih na početnoj čitaju isti fetch.
 */

type TickerApiResponse = {
  live: Array<{ id: number; name: string; date: string; dateEnd: string | null; level: string; detailItems: TickerItem["detailItems"]; nocCode: string | null; countryCode2: string | null; forceStatus: "LIVE" | "USKORO" | null; tickerStatus: "LIVE" | "USKORO" | "NEXT" | "NEUTRAL" | "REVIEW" }>;
  upcoming: Array<{ id: number; name: string; date: string; level: string; location: string | null; href: string | null }>;
};

type TickerData = {
  state: "loading" | "ready" | "error";
  liveItems: TickerItem[];
  upcomingItems: TickerItem[];
  retry: () => void;
};

const REFRESH_MS = 60_000;
const TickerDataContext = createContext<TickerData | null>(null);

export function TickerDataProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();
  const t = useTranslations("home");
  const common = useTranslations("common");
  const [data, setData] = useState<TickerApiResponse | null>(null);
  const [state, setState] = useState<TickerData["state"]>("loading");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    // v = bucket jednak REFRESH_MS: svi posetioci dele isti CDN odgovor (s-maxage=60). Kraći bucket je pravio
    // novi cache key svakih 5 s, pa je funkcija (i baza) radila 12× češće nego što keš dozvoljava.
    fetch(`/api/homepage/ticker?scope=${scope ?? "srb"}&locale=${locale}&v=${Math.floor(Date.now() / REFRESH_MS)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Ticker request failed")))
      .then((result: TickerApiResponse) => { setData(result); setState("ready"); })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Postojeći podaci ostaju vidljivi; greška se pokazuje samo ako još ništa nemamo.
        setState((current) => current === "ready" ? current : "error");
      });
    return () => controller.abort();
  }, [attempt, locale, scope]);

  useEffect(() => {
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") retry(); }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [retry]);

  // Bez Supabase Realtime: svaki posetilac na svakoj javnoj stranici držao je konekciju dok je nešto LIVE
  // (free tier: 200 istovremenih). Admin izmene stižu kroz poll od REFRESH_MS.

  const value = useMemo<TickerData>(() => ({
    state,
    retry,
    liveItems: (data?.live ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      date: item.date,
      endDate: item.dateEnd ?? undefined,
      level: item.level,
      status: item.forceStatus ?? item.tickerStatus,
      detailItems: item.detailItems?.length ? item.detailItems : item.forceStatus === "LIVE" ? [{ text: t("inProgress") }] : undefined,
      href: `/takmicenja/${item.id}`,
      nocCode: item.nocCode ?? undefined,
      countryCode2: item.countryCode2 ?? undefined,
    })),
    upcomingItems: (data?.upcoming ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      date: item.date,
      level: item.level,
      status: "USKORO",
      detailText: item.location || common("serbia"),
      href: item.href ?? undefined,
    })),
  }), [common, data, retry, state, t]);

  return <TickerDataContext.Provider value={value}>{children}</TickerDataContext.Provider>;
}

export function useTickerData() {
  const context = useContext(TickerDataContext);
  if (!context) throw new Error("useTickerData must be used within TickerDataProvider");
  return context;
}
