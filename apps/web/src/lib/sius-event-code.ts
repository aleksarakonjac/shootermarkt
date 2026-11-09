/**
 * SIUS EventCode kandidati za (disciplina, kategorija), po prioritetu: obrnuto od splitEventCode u sius-import.ts.
 * Juniori imaju sufiks J (ARWJ, APMTJ); evropska U16/U18 prvenstva 10ARU18W / 10APU16M, a neka U18
 * prvenstva (npr. Tallinn) objavljuju mlađe juniore pod J kodom.
 * Kategorija bez sopstvenog SIUS eventa vraća [] — nikad seniorski event (isti kod → seniorski skorovi
 * bi se upisali kao juniorski/kadetski).
 */
export function siusEventCodes(disciplineCode: string, category: string): string[] {
  if (category === "senior" || category === "open") return [disciplineCode];
  if (category === "junior") return [`${disciplineCode}J`];
  const youth = disciplineCode.match(/^(AR|AP)([MW])$/);
  if (youth && category === "mladji_junior") return [`10${youth[1]}U18${youth[2]}`, `${disciplineCode}J`];
  if (youth && category === "kadet") return [`10${youth[1]}U16${youth[2]}`];
  return [];
}
