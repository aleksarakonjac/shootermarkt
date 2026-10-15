"use client";

import { Ticker } from "../ticker";
import { useTickerData } from "./live-ticker-data";

/** Live traka u sticky header-u — vidljiva na svim stranicama samo dok je nešto LIVE. */
export function HeaderLiveTicker() {
  const { liveItems, upcomingItems } = useTickerData();
  if (liveItems.length === 0) return null;
  // -mb-px: donja ivica trake preklapa border header-a, da ne bude dupla linija.
  return <div className="-mb-px"><Ticker liveItems={liveItems} upcomingItems={upcomingItems} /></div>;
}
