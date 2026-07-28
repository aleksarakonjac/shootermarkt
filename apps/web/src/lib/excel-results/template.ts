import * as XLSX from "xlsx";

export const EXCEL_RESULT_COLUMNS = [
  { key: "competition_id", required: false, description: "ID postojećeg takmičenja. Ako je popunjen, ostali podaci o takmičenju se ignorišu." },
  { key: "competition_name", required: true, description: "Naziv takmičenja. Obavezan ako competition_id nije popunjen." },
  { key: "competition_date", required: true, description: "Datum početka u formatu YYYY-MM-DD." },
  { key: "competition_date_end", required: false, description: "Datum završetka u formatu YYYY-MM-DD." },
  { key: "competition_location", required: false, description: "Mesto održavanja." },
  { key: "competition_level", required: true, description: "club, regional, national, international, continental, world ili olympic." },
  { key: "competition_event_type", required: false, description: "championship, world_cup, champions_league, cup, grand_prix, league_round, friendly ili other." },
  { key: "competition_organizer", required: false, description: "Organizator, npr. SSS, ISSF ili ESC." },
  { key: "first_name", required: true, description: "Ime strelca." },
  { key: "last_name", required: true, description: "Prezime strelca." },
  { key: "team_noc", required: false, description: "Troslovni kod države, npr. SRB. Ako je prazno, koristi se SRB." },
  { key: "birth_year", required: false, description: "Godina rođenja, npr. 2004." },
  { key: "gender", required: false, description: "M ili F. Ako je prazno, izvodi se iz discipline." },
  { key: "apparatus", required: false, description: "air_rifle, air_pistol, rifle ili pistol. Ako je prazno, izvodi se iz discipline." },
  { key: "club_name", required: false, description: "Naziv ili skraćenica kluba." },
  { key: "discipline_code", required: true, description: "ARM, ARW, APM, APW, R3PM, R3PW ili SPW." },
  { key: "result_category", required: false, description: "cadet, youth_junior, junior, u23 ili senior. Podrazumevano senior." },
  { key: "qualification_total", required: true, description: "Ukupan rezultat kvalifikacije." },
  { key: "qualification_inners", required: false, description: "Broj unutrašnjih desetki." },
  { key: "qualification_rank", required: false, description: "Plasman u kvalifikaciji." },
  { key: "series_1", required: false, description: "Prva serija kvalifikacije." },
  { key: "series_2", required: false, description: "Druga serija kvalifikacije." },
  { key: "series_3", required: false, description: "Treća serija kvalifikacije." },
  { key: "series_4", required: false, description: "Četvrta serija kvalifikacije." },
  { key: "series_5", required: false, description: "Peta serija kvalifikacije." },
  { key: "series_6", required: false, description: "Šesta serija kvalifikacije." },
  { key: "qualified", required: false, description: "DA ili NE, ako je strelac prošao u finale." },
  { key: "final_total", required: false, description: "Ukupan rezultat finala." },
  { key: "final_rank", required: false, description: "Plasman u finalu." },
] as const;

export const EXCEL_RESULT_HEADERS = EXCEL_RESULT_COLUMNS.map((column) => column.key);
export const EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME = "__PRIMER__";

const EXCEL_TEMPLATE_EXAMPLE_ROW = [
  "",
  "Kup Srbije 2026",
  "2026-06-14",
  "2026-06-15",
  "Novi Sad",
  "national",
  "championship",
  "SSS",
  EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME,
  "Strelac - ne uvozi se",
  "SRB",
  2002,
  "M",
  "air_rifle",
  "SK Novi Sad",
  "ARM",
  "senior",
  628.4,
  54,
  1,
  104.5,
  104.8,
  104.7,
  104.6,
  104.9,
  104.9,
  "DA",
  251.2,
  1,
];

export function createResultsTemplate(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const resultsSheet = XLSX.utils.aoa_to_sheet([EXCEL_RESULT_HEADERS, EXCEL_TEMPLATE_EXAMPLE_ROW]);

  resultsSheet["!cols"] = EXCEL_RESULT_COLUMNS.map((column) => ({
    wch: Math.max(14, Math.min(28, column.key.length + 2)),
  }));
  resultsSheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(EXCEL_RESULT_HEADERS.length - 1)}1` };
  resultsSheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["Napomena", "Red sa __PRIMER__ se automatski preskače pri uvozu. Obriši ga ili zameni stvarnim podacima."],
    [],
    ["Kolona", "Obavezno", "Opis"],
    ...EXCEL_RESULT_COLUMNS.map((column) => [column.key, column.required ? "DA" : "NE", column.description]),
  ]);
  instructionsSheet["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 88 }];
  instructionsSheet["!freeze"] = { xSplit: 0, ySplit: 3 };

  XLSX.utils.book_append_sheet(workbook, resultsSheet, "Rezultati");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Uputstvo");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}
