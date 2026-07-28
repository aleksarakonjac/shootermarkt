/**
 * IANA timezone lookup by country ISO-2 code.
 * For multi-zone countries (US, AU, RU, etc.) we also check the city name.
 */

const COUNTRY_TZ: Record<string, string> = {
  // Europe
  AL: "Europe/Tirane",
  AT: "Europe/Vienna",
  AZ: "Asia/Baku",
  BA: "Europe/Sarajevo",
  BE: "Europe/Brussels",
  BG: "Europe/Sofia",
  BY: "Europe/Minsk",
  CH: "Europe/Zurich",
  CY: "Asia/Nicosia",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin",
  DK: "Europe/Copenhagen",
  EE: "Europe/Tallinn",
  ES: "Europe/Madrid",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  GB: "Europe/London",
  GE: "Asia/Tbilisi",
  GR: "Europe/Athens",
  HR: "Europe/Zagreb",
  HU: "Europe/Budapest",
  IE: "Europe/Dublin",
  IT: "Europe/Rome",
  KZ: "Asia/Almaty",
  LT: "Europe/Vilnius",
  LV: "Europe/Riga",
  MD: "Europe/Chisinau",
  ME: "Europe/Podgorica",
  MK: "Europe/Skopje",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  PL: "Europe/Warsaw",
  PT: "Europe/Lisbon",
  RO: "Europe/Bucharest",
  RS: "Europe/Belgrade",
  SE: "Europe/Stockholm",
  SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava",
  TR: "Europe/Istanbul",
  UA: "Europe/Kyiv",
  UZ: "Asia/Tashkent",
  // Asia
  AE: "Asia/Dubai",
  AM: "Asia/Yerevan",
  BH: "Asia/Bahrain",
  BD: "Asia/Dhaka",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  ID: "Asia/Jakarta",
  IL: "Asia/Jerusalem",
  IN: "Asia/Kolkata",
  IQ: "Asia/Baghdad",
  IR: "Asia/Tehran",
  JP: "Asia/Tokyo",
  KG: "Asia/Bishkek",
  KH: "Asia/Phnom_Penh",
  KR: "Asia/Seoul",
  KW: "Asia/Kuwait",
  LB: "Asia/Beirut",
  MM: "Asia/Rangoon",
  MN: "Asia/Ulaanbaatar",
  MV: "Indian/Maldives",
  MY: "Asia/Kuala_Lumpur",
  NP: "Asia/Kathmandu",
  OM: "Asia/Muscat",
  PH: "Asia/Manila",
  PK: "Asia/Karachi",
  QA: "Asia/Qatar",
  SA: "Asia/Riyadh",
  SG: "Asia/Singapore",
  TH: "Asia/Bangkok",
  TJ: "Asia/Dushanbe",
  TM: "Asia/Ashgabat",
  TW: "Asia/Taipei",
  VN: "Asia/Ho_Chi_Minh",
  // Americas
  AR: "America/Argentina/Buenos_Aires",
  BR: "America/Sao_Paulo",
  CA: "America/Toronto",
  CL: "America/Santiago",
  CO: "America/Bogota",
  CU: "America/Havana",
  EC: "America/Guayaquil",
  MX: "America/Mexico_City",
  PE: "America/Lima",
  VE: "America/Caracas",
  // Africa & Middle East
  DZ: "Africa/Algiers",
  EG: "Africa/Cairo",
  ET: "Africa/Addis_Ababa",
  GH: "Africa/Accra",
  KE: "Africa/Nairobi",
  MA: "Africa/Casablanca",
  NG: "Africa/Lagos",
  TN: "Africa/Tunis",
  ZA: "Africa/Johannesburg",
  // Oceania
  NZ: "Pacific/Auckland",
};

/** US city → timezone (major ISSF host cities) */
const US_CITY_TZ: Array<[RegExp, string]> = [
  [/fort benning|columbus|atlanta|georgia/i, "America/New_York"],
  [/camp perry|ohio/i,                       "America/New_York"],
  [/los angeles|san francisco|california/i,  "America/Los_Angeles"],
  [/phoenix|arizona/i,                       "America/Phoenix"],
  [/houston|dallas|texas/i,                  "America/Chicago"],
  [/new york/i,                              "America/New_York"],
];

/** Russia city → timezone */
const RU_CITY_TZ: Array<[RegExp, string]> = [
  [/moscow|kazan|nizhny/i, "Europe/Moscow"],
  [/novosibirsk/i,         "Asia/Novosibirsk"],
  [/vladivostok/i,         "Asia/Vladivostok"],
  [/irkutsk/i,             "Asia/Irkutsk"],
  [/yekaterinburg/i,       "Asia/Yekaterinburg"],
];

/** Australia city → timezone */
const AU_CITY_TZ: Array<[RegExp, string]> = [
  [/sydney|canberra|brisbane|newcastle/i, "Australia/Sydney"],
  [/melbourne/i,                          "Australia/Melbourne"],
  [/perth/i,                              "Australia/Perth"],
  [/adelaide/i,                           "Australia/Adelaide"],
];

/** ISO 3-letter → ISO 2-letter for the countries we host competitions in. */
const ISO3_TO_2: Record<string, string> = {
  ALB: "AL", AUT: "AT", AZE: "AZ", BIH: "BA", BEL: "BE", BGR: "BG", BLR: "BY",
  CHE: "CH", CYP: "CY", CZE: "CZ", DEU: "DE", DNK: "DK", EST: "EE", ESP: "ES",
  FIN: "FI", FRA: "FR", GBR: "GB", GEO: "GE", GRC: "GR", HRV: "HR", HUN: "HU",
  IRL: "IE", ITA: "IT", KAZ: "KZ", LTU: "LT", LVA: "LV", MDA: "MD", MNE: "ME",
  MKD: "MK", NLD: "NL", NOR: "NO", POL: "PL", PRT: "PT", ROU: "RO", SRB: "RS",
  SWE: "SE", SVN: "SI", SVK: "SK", TUR: "TR", UKR: "UA", UZB: "UZ",
  ARE: "AE", ARM: "AM", BHR: "BH", BGD: "BD", CHN: "CN", HKG: "HK", IDN: "ID",
  ISR: "IL", IND: "IN", IRQ: "IQ", IRN: "IR", JPN: "JP", KGZ: "KG", KHM: "KH",
  KOR: "KR", KWT: "KW", LBN: "LB", MMR: "MM", MNG: "MN", MDV: "MV", MYS: "MY",
  NPL: "NP", OMN: "OM", PHL: "PH", PAK: "PK", QAT: "QA", SAU: "SA", SGP: "SG",
  THA: "TH", TJK: "TJ", TKM: "TM", TWN: "TW", VNM: "VN",
  ARG: "AR", BRA: "BR", CAN: "CA", CHL: "CL", COL: "CO", CUB: "CU", ECU: "EC",
  MEX: "MX", PER: "PE", VEN: "VE",
  DZA: "DZ", EGY: "EG", ETH: "ET", GHA: "GH", KEN: "KE", MAR: "MA", NGA: "NG",
  TUN: "TN", ZAF: "ZA",
  AUS: "AU", NZL: "NZ",
  USA: "US", RUS: "RU",
};

export function guessTimezone(city: string | null, countryCode: string | null): string {
  const raw = (countryCode ?? "").toUpperCase();
  const cc = raw.length === 3 ? (ISO3_TO_2[raw] ?? raw) : raw;
  const cityLower = (city ?? "").toLowerCase();

  if (cc === "US") {
    for (const [re, tz] of US_CITY_TZ) {
      if (re.test(cityLower)) return tz;
    }
    return "America/New_York"; // default for US
  }
  if (cc === "RU") {
    for (const [re, tz] of RU_CITY_TZ) {
      if (re.test(cityLower)) return tz;
    }
    return "Europe/Moscow";
  }
  if (cc === "AU") {
    for (const [re, tz] of AU_CITY_TZ) {
      if (re.test(cityLower)) return tz;
    }
    return "Australia/Sydney";
  }

  return COUNTRY_TZ[cc] ?? "UTC";
}

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
