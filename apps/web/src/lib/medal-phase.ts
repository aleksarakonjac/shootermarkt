/**
 * Koja faza jedne discipline (po kategoriji) na In focus kartici dobija zlatni/srebrni/bronzani krug.
 * Medalje dobija samo konačna faza, i to tek kad je gotova:
 *
 * 1. Postoji finale (u rasporedu) → medalje samo u finalu, kad nije u toku i ima rezultate.
 * 2. Nema finala → kvalifikacije, kad nisu u toku i imaju rezultate, ako je
 *    - disciplina bez finala po formatu (50m ležeći, 50m pištolj, 25m standard pištolj, sve 300m; RFPM ima finale, format
 *      još nije definisan pa tu važi pravilo ispod), ili
 *    - domaće takmičenje (nije međunarodno) koje je završeno: finale tu nije održano,
 *      pa se medalje dele posle kvalifikacija. Međunarodno bez finala u bazi ne dobija medalje
 *      (finale je verovatno samo neuvezeno).
 * Elim se nikad ne nagrađuje: u 300m (R3P-stil) elim samo smanjuje polje pred kvalifikacije.
 */

const NO_FINAL_DISCIPLINES: ReadonlySet<string> = new Set([
  "RPRM", "RPRW", "FPM", "FPW", "STPM", "STPW",
  "R3P300M", "R3P300W", "RPR300M", "RPR300W", "STR300",
]);
const INTERNATIONAL_LEVELS: ReadonlySet<string> = new Set(["olympic", "world", "continental", "international"]);

type PhaseState = { isLive: boolean; hasResults: boolean };

export function medalStage(input: {
  discCode: string;
  level: string;
  competitionOver: boolean;
  finalScheduled: boolean;
  final?: PhaseState;
  qual?: PhaseState;
}): "final" | "qual" | null {
  const done = (phase?: PhaseState) => phase != null && !phase.isLive && phase.hasResults;
  if (input.finalScheduled) return done(input.final) ? "final" : null;
  if (!done(input.qual)) return null;
  const noFinalFormat = NO_FINAL_DISCIPLINES.has(input.discCode);
  const domesticOver = input.competitionOver && !INTERNATIONAL_LEVELS.has(input.level.toLowerCase());
  return noFinalFormat || domesticOver ? "qual" : null;
}
