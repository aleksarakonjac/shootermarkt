"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
    fetch(`/api/homepage/ticker?scope=${scope ?? "srb"}&locale=${locale}`, { signal: controller.signal })
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
    const interval = window.setInterval(retry, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [retry]);

  // Realtime: odmah osveži kad admin promeni override-e ili raspored.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("ticker-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ticker_live_overrides" }, retry)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_schedule" }, retry)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticker_custom_upcoming" }, retry)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [retry]);

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
