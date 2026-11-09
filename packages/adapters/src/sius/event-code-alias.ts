/**
 * SIUS EventCode → naš kod discipline. SIUS 300m događaje zove "300R3PM" umesto "R3P300M", a
 * ponovljene mečeve iste discipline "R3PM1"/"R3PM2" (2nd Event). Normalizuje se na izvoru
 * (fetchSiusEvents), pa dalje sve (uvoz, cron, brojanje mečeva) vidi samo naše kodove.
 * Sufiks J (junior) se čuva: "300RPRMJ" → "RPR300MJ".
 */
const SIUS_ALIASES: Record<string, string> = {
  "300R3PM": "R3P300M",
  "300R3PW": "R3P300W",
  "300RPRM": "RPR300M",
  "300RPRW": "RPR300W",
  "300STR3PO": "STR300",
};

// Ponovljeni meč iste discipline: R3PM1, R3PM2 → R3PM (match # dodeljuje assignSiusMatches po datumu)
const NUMBERED = /^(R3PM|R3PW|RFPM|SPW|300RPRM|300RPRW)[12]$/;

export function canonicalSiusEventCode(raw: string): string {
  const base = NUMBERED.test(raw) ? raw.slice(0, -1) : raw;
  const junior = /J$/.test(base) && SIUS_ALIASES[base.slice(0, -1)];
  return junior ? `${junior}J` : (SIUS_ALIASES[base] ?? base);
}
