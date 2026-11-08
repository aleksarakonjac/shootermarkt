/**
 * SIUS EventCode za (disciplina, kategorija): obrnuto od splitEventCode u sius-import.ts.
 * Juniori imaju sufiks J (ARWJ, APMTJ); evropska U16/U18 prvenstva 10ARU18W / 10APU16M.
 * Bez ovoga juniorski slot dobija seniorski SIUS event (isti kod).
 */
export function siusEventCode(disciplineCode: string, category: string): string {
  if (category === "junior") return `${disciplineCode}J`;
  const youth = disciplineCode.match(/^(AR|AP)([MW])$/);
  if (youth && (category === "mladji_junior" || category === "kadet")) {
    return `10${youth[1]}${category === "mladji_junior" ? "U18" : "U16"}${youth[2]}`;
  }
  return disciplineCode;
}
