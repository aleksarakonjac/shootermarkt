type TickerSlot = { discCode: string; stage: string; startTime: Date; endTime: Date | null };

const DURATION_MINUTES: Record<string, Record<string, number>> = {
  ARM: { qual: 75, final: 30 }, ARW: { qual: 75, final: 30 }, APM: { qual: 75, final: 30 }, APW: { qual: 75, final: 30 },
  R3PM: { qual: 105, elimination: 105, final: 40 }, R3PW: { qual: 105, elimination: 105, final: 40 },
  SPW: { qual: 45, qual_precision: 45, qual_rapid: 30, final: 30 },
  ARMT: { qual: 40, final: 30 }, APMT: { qual: 40, final: 30 },
};

export function getTickerSlotEnd(slot: TickerSlot) {
  if (slot.endTime) return slot.endTime;
  const minutes = DURATION_MINUTES[slot.discCode]?.[slot.stage];
  return minutes == null ? null : new Date(slot.startTime.getTime() + minutes * 60_000);
}

export function isTickerSlotLive(slot: TickerSlot, now: Date) {
  const endTime = getTickerSlotEnd(slot);
  return slot.startTime <= now && endTime != null && endTime >= now;
}
