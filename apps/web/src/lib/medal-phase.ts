import { isQualOnlyDiscipline } from "./final-medals";

/**
 * Koja faza jedne discipline (po kategoriji) na In focus kartici dobija zlatni/srebrni/bronzani krug.
 * Medalje dobija samo konačna faza, i to tek kad je gotova:
 *
 * 0. Admin oznaka "nema finala" (i nema rezultata finala) → kvalifikacije, i ako satnica najavljuje finale.
 * 1. Postoji finale (u rasporedu) → medalje samo u finalu, kad nije u toku i ima rezultate.
 * 2. Nema finala → kvalifikacije, kad nisu u toku i imaju rezultate, ako je
 *    - disciplina bez finala po formatu (50m ležeći, 50m pištolj, 25m standard pištolj, sve 300m; RFPM ima finale, format
 *      još nije definisan pa tu važi pravilo ispod), ili
 *    - domaće takmičenje (nije međunarodno) koje je završeno: finale tu nije održano,
 *      pa se medalje dele posle kvalifikacija. Međunarodno bez finala u bazi ne dobija medalje
 *      (finale je verovatno samo neuvezeno).
 * Elim se nikad ne nagrađuje: u 300m (R3P-stil) elim samo smanjuje polje pred kvalifikacije.
 */

const INTERNATIONAL_LEVELS: ReadonlySet<string> = new Set(["olympic", "world", "continental", "international"]);

type PhaseState = { isLive: boolean; hasResults: boolean };

export function medalStage(input: {
  discCode: string;
  level: string;
  competitionOver: boolean;
  finalScheduled: boolean;
  markedNoFinal?: boolean;
  final?: PhaseState;
  qual?: PhaseState;
}): "final" | "qual" | null {
  const done = (phase?: PhaseState) => phase != null && !phase.isLive && phase.hasResults;
  const marked = input.markedNoFinal === true && !input.final?.hasResults;
  if (!marked && input.finalScheduled) return done(input.final) ? "final" : null;
  if (!done(input.qual)) return null;
  const domesticOver = input.competitionOver && !INTERNATIONAL_LEVELS.has(input.level.toLowerCase());
  return marked || isQualOnlyDiscipline(input.discCode) || domesticOver ? "qual" : null;
}
