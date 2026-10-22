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

// Venue timezone from the competition's location text (ISSF venues are cities), with NOC as single-timezone fallback.
const CITY_TZ: Record<string, string> = {
  ruse: "Europe/Sofia", burgas: "Europe/Sofia", sofia: "Europe/Sofia", plovdiv: "Europe/Sofia",
  osijek: "Europe/Zagreb", zagreb: "Europe/Zagreb", belgrade: "Europe/Belgrade", beograd: "Europe/Belgrade",
  tallinn: "Europe/Tallinn", gyor: "Europe/Budapest", budapest: "Europe/Budapest",
  suhl: "Europe/Berlin", munich: "Europe/Berlin", berlin: "Europe/Berlin", hannover: "Europe/Berlin",
  granada: "Europe/Madrid", "las palmas": "Atlantic/Canary", madrid: "Europe/Madrid",
  rome: "Europe/Rome", lonato: "Europe/Rome", paris: "Europe/Paris", chateauroux: "Europe/Paris",
  baku: "Asia/Baku", yerevan: "Asia/Yerevan", tbilisi: "Asia/Tbilisi",
  cairo: "Africa/Cairo", doha: "Asia/Qatar", jakarta: "Asia/Jakarta",
  "new delhi": "Asia/Kolkata", bhopal: "Asia/Kolkata",
  shymkent: "Asia/Almaty", almaty: "Asia/Almaty", astana: "Asia/Almaty",
  hangzhou: "Asia/Shanghai", ningbo: "Asia/Shanghai", changwon: "Asia/Seoul", seoul: "Asia/Seoul",
  lima: "America/Lima", "buenos aires": "America/Argentina/Buenos_Aires", asuncion: "America/Asuncion",
  "rio de janeiro": "America/Sao_Paulo", "sao paulo": "America/Sao_Paulo", "fort benning": "America/New_York",
};

const NOC_TZ: Record<string, string> = {
  SRB: "Europe/Belgrade", BUL: "Europe/Sofia", CRO: "Europe/Zagreb", GER: "Europe/Berlin", ESP: "Europe/Madrid",
  ITA: "Europe/Rome", FRA: "Europe/Paris", HUN: "Europe/Budapest", EST: "Europe/Tallinn", EGY: "Africa/Cairo",
  QAT: "Asia/Qatar", IND: "Asia/Kolkata", CHN: "Asia/Shanghai", KOR: "Asia/Seoul", AZE: "Asia/Baku",
  ARM: "Asia/Yerevan", GEO: "Asia/Tbilisi", KAZ: "Asia/Almaty", INA: "Asia/Jakarta", PER: "America/Lima",
  ARG: "America/Argentina/Buenos_Aires", PAR: "America/Asuncion",
};

/** null = unknown venue; callers must not guess (a wrong zone shifts every slot by hours). */
export function timezoneForVenue(location: string | null, noc: string | null): string | null {
  const key = (location ?? "").split(",").map((p) => p.trim().toLowerCase());
  for (const part of key) if (CITY_TZ[part]) return CITY_TZ[part];
  return (noc && NOC_TZ[noc]) || null;
}
