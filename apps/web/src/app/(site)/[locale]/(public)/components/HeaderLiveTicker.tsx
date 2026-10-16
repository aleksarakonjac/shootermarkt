"use client";

import { Ticker } from "../ticker";
import { useTickerData } from "./live-ticker-data";

/** Live traka u sticky header-u — samo dok je neka faza stvarno LIVE po rasporedu. */
export function HeaderLiveTicker() {
  const { liveItems, upcomingItems } = useTickerData();
  if (!liveItems.some((item) => item.status === "LIVE")) return null;
  // -mb-px: donja ivica trake preklapa border header-a, da ne bude dupla linija.
  return <div className="-mb-px"><Ticker liveItems={liveItems} upcomingItems={upcomingItems} /></div>;
}

/**
 * Takmičenje je u toku, ali ništa nije LIVE u ovom trenutku (pauza između faza, sledeća faza,
 * rezultati): traka stoji na vrhu stranice i odlazi skrolom — nije sticky.
 */
export function TopOfPageTicker() {
  const { liveItems, upcomingItems } = useTickerData();
  if (liveItems.length === 0 || liveItems.some((item) => item.status === "LIVE")) return null;
  return <Ticker liveItems={liveItems} upcomingItems={upcomingItems} />;
}
