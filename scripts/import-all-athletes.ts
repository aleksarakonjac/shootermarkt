/**
 * One-time full ISSF athlete import for all major NOC codes.
 * Run: npx tsx scripts/import-all-athletes.ts
 *
 * Idempotent — uses onConflictDoNothing via the same API route used by admin UI.
 * Requires the dev server to be running (or set BASE_URL to prod).
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const IMPORT_SECRET = process.env.IMPORT_SECRET ?? "";
const START_FROM = process.env.START_FROM ?? "";

// All IOC NOC codes (206 nations)
const NOC_LIST = [
  // Neutral
  "AIN",
  // Europe
  "ALB", "AND", "ARM", "AUT", "AZE", "BEL", "BIH", "BLR", "BUL", "CRO",
  "CYP", "CZE", "DEN", "ESP", "EST", "FIN", "FRA", "GBR", "GEO", "GER",
  "GRE", "HUN", "IRL", "ISL", "ISR", "ITA", "KOS", "LAT", "LIE", "LTU",
  "LUX", "MDA", "MKD", "MLT", "MNE", "MON", "NED", "NOR", "POL", "POR",
  "ROU", "RUS", "SMR", "SRB", "SLO", "SVK", "SWE", "SUI", "TUR", "UKR",
  // Asia
  "AFG", "BAN", "BHU", "BRN", "CAM", "CHN", "HKG", "INA", "IND", "IRI",
  "IRQ", "JOR", "JPN", "KAZ", "KGZ", "KOR", "KSA", "KUW", "LAO", "LBN",
  "MAS", "MDV", "MGL", "MYA", "NEP", "OMA", "PAK", "PHI", "PRK", "QAT",
  "SGP", "SRI", "SYR", "TJK", "TKM", "TLS", "TPE", "UAE", "UZB", "VIE",
  "YEM",
  // Africa
  "AGO", "ALG", "BEN", "BOT", "BUR", "CAF", "CGO", "CHA", "CIV", "CMR",
  "COD", "COM", "CPV", "DJI", "EGY", "ERI", "ESW", "ETH", "GAB", "GAM",
  "GBS", "GHA", "GUI", "GUQ", "KEN", "LBA", "LES", "LIB", "MAD", "MAR",
  "MAW", "MLI", "MOZ", "MRI", "MTN", "NAM", "NIG", "NGR",
  "RSA", "RWA", "SEN", "SEY", "SLE", "SOM", "SSD", "STP", "SUD", "TAN",
  "TOG", "TUN", "UGA", "ZAM", "ZIM",
  // Americas
  "ANT", "ARG", "ARU", "BAH", "BAR", "BER", "BOL", "BRA", "CAY", "CHI",
  "COL", "CRC", "CUB", "DMA", "DOM", "ECU", "ESA", "GRN", "GUA", "GUY",
  "HAI", "HON", "JAM", "LCA", "MEX", "NCA", "PAN", "PAR", "PER", "PUR",
  "SKN", "SUR", "TTO", "URU", "USA", "VEN", "VIN",
  // Oceania
  "ASA", "AUS", "COK", "FIJ", "FSM", "GUM", "KIR", "MHL", "NRU", "NZL",
  "PLW", "PNG", "SAM", "SOL", "TGA", "TUV", "VAN",
];

async function importNoc(noc: string): Promise<{ inserted: number; skipped: number; total: number }> {
  const res = await fetch(`${BASE_URL}/api/admin/issf/athletes/bulk-nation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(IMPORT_SECRET ? { "x-import-secret": IMPORT_SECRET } : {}),
    },
    body: JSON.stringify({ noc }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

async function main() {
  const list = START_FROM
    ? NOC_LIST.slice(NOC_LIST.indexOf(START_FROM))
    : NOC_LIST;

  if (START_FROM && list.length === NOC_LIST.length) {
    console.warn(`START_FROM="${START_FROM}" not found in NOC_LIST, starting from beginning`);
  }

  console.log(`Importing athletes for ${list.length} NOC codes from ${BASE_URL}${START_FROM ? ` (starting from ${START_FROM})` : ""}\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalAthletes = 0;
  const failed: string[] = [];

  for (const noc of list) {
    try {
      const result = await importNoc(noc);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      totalAthletes += result.total;
      if (result.total > 0) {
        console.log(`${noc.padEnd(4)} — +${result.inserted} uvezeno, ${result.skipped} preskočeno (${result.total} ukupno)`);
      }
    } catch (err) {
      console.error(`${noc.padEnd(4)} — GREŠKA: ${err}`);
      failed.push(noc);
    }

    // Small delay to avoid hammering ISSF API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Ukupno: ${totalInserted} uvezeno, ${totalSkipped} preskočeno, ${totalAthletes} ukupno`);
  if (failed.length > 0) {
    console.log(`Neuspešno: ${failed.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
