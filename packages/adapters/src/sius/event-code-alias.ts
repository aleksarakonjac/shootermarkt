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

/**
 * Mladi događaji čiji kod nije "10ARU18M" (npr. "ARMY" = "10m AIR RIFLE MEN YOUTH"):
 * disciplina, pol i uzrast (samo eksplicitno U16/U18) se čitaju iz SIUS naziva; "YOUTH" bez broja se ne pogađa.
 * Samo pojedinačni vazdušni događaji; team/mixed/trio/duet/solo se ne diraju.
 */
export function siusEventCode(rawCode: string, name: string): string {
  const code = canonicalSiusEventCode(rawCode);
  if (/^10(AR|AP)U(16|18)[MW]$/.test(code) || /TEAM|MIXED|TRIO|DUET|SOLO|-ECH-/i.test(`${code} ${name}`)) return code;
  const d = name.match(/\bAIR (RIFLE|PISTOL)\b/i);
  const g = name.match(/\b(WOMEN|MEN)\b/i);
  const a = name.match(/\b(U16|U18)\b/i);
  if (!d || !g || !a) return code;
  return `10${d[1].toUpperCase() === "RIFLE" ? "AR" : "AP"}${a[1].toUpperCase()}${g[1].toUpperCase() === "MEN" ? "M" : "W"}`;
}
