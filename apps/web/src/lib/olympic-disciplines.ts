/** Olimpijske pojedinačne discipline puška/pištolj i miks timovi (LA 2028). */
export const OLYMPIC_DISCIPLINES: ReadonlySet<string> = new Set(["ARM", "ARW", "ARMT", "R3PM", "R3PW", "APM", "APW", "APMT", "SPW", "RFPM"]);

export const isOlympicDiscipline = (code: string | null | undefined) => code != null && OLYMPIC_DISCIPLINES.has(code);
