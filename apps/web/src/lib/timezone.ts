/**
 * Convert a venue-local date+time string to a UTC Date.
 * "2026-07-22" + "09:15" in "Asia/Shanghai" → 2026-07-22T01:15:00Z
 */
export function venueLocalToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  // Treat the time as UTC first (naive), then find the actual offset.
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);

  // Ask Intl what the timezone shows for this naive UTC moment.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    fmt.formatToParts(naive).map(({ type, value }) => [type, value])
  );

  const hour = parts.hour === "24" ? "00" : parts.hour;
  const tzShown = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}Z`
  );

  // offsetMs = what TZ shows (as UTC) minus what we put in
  const offsetMs = tzShown.getTime() - naive.getTime();

  // real UTC = naive − offset
  return new Date(naive.getTime() - offsetMs);
}
