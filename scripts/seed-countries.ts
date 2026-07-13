/**
 * Seed countries table with all IOC/NOC codes + full names.
 * Uses NOC code as primary `code` field so it matches shooters.nationality directly.
 * After insert, backfills shooters.country_id FK.
 *
 * Run: npx tsx scripts/seed-countries.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { countries } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// NOC code → [ISO alpha-2, full name (srpski/međunarodni)]
// code = NOC code (matches shooters.nationality), code2 = ISO alpha-2 for flags
const ALL_COUNTRIES: Array<{ code: string; code2: string; name: string }> = [
  // Neutralni
  { code: "AIN", code2: "",   name: "Individualni neutralni sportisti" },

  // Evropa
  { code: "ALB", code2: "AL", name: "Albanija" },
  { code: "AND", code2: "AD", name: "Andora" },
  { code: "ARM", code2: "AM", name: "Jermenija" },
  { code: "AUT", code2: "AT", name: "Austrija" },
  { code: "AZE", code2: "AZ", name: "Azerbejdžan" },
  { code: "BEL", code2: "BE", name: "Belgija" },
  { code: "BIH", code2: "BA", name: "Bosna i Hercegovina" },
  { code: "BLR", code2: "BY", name: "Belorusija" },
  { code: "BUL", code2: "BG", name: "Bugarska" },
  { code: "CRO", code2: "HR", name: "Hrvatska" },
  { code: "CYP", code2: "CY", name: "Kipar" },
  { code: "CZE", code2: "CZ", name: "Češka" },
  { code: "DEN", code2: "DK", name: "Danska" },
  { code: "ESP", code2: "ES", name: "Španija" },
  { code: "EST", code2: "EE", name: "Estonija" },
  { code: "FIN", code2: "FI", name: "Finska" },
  { code: "FRA", code2: "FR", name: "Francuska" },
  { code: "GBR", code2: "GB", name: "Velika Britanija" },
  { code: "GEO", code2: "GE", name: "Gruzija" },
  { code: "GER", code2: "DE", name: "Nemačka" },
  { code: "GRE", code2: "GR", name: "Grčka" },
  { code: "HUN", code2: "HU", name: "Mađarska" },
  { code: "IRL", code2: "IE", name: "Irska" },
  { code: "ISL", code2: "IS", name: "Island" },
  { code: "ISR", code2: "IL", name: "Izrael" },
  { code: "ITA", code2: "IT", name: "Italija" },
  { code: "KOS", code2: "XK", name: "Kosovo" },
  { code: "LAT", code2: "LV", name: "Letonija" },
  { code: "LIE", code2: "LI", name: "Lihtenštajn" },
  { code: "LTU", code2: "LT", name: "Litvanija" },
  { code: "LUX", code2: "LU", name: "Luksemburg" },
  { code: "MDA", code2: "MD", name: "Moldavija" },
  { code: "MKD", code2: "MK", name: "Severna Makedonija" },
  { code: "MLT", code2: "MT", name: "Malta" },
  { code: "MNE", code2: "ME", name: "Crna Gora" },
  { code: "MON", code2: "MC", name: "Monako" },
  { code: "NED", code2: "NL", name: "Holandija" },
  { code: "NOR", code2: "NO", name: "Norveška" },
  { code: "POL", code2: "PL", name: "Poljska" },
  { code: "POR", code2: "PT", name: "Portugalija" },
  { code: "ROU", code2: "RO", name: "Rumunija" },
  { code: "RUS", code2: "RU", name: "Rusija" },
  { code: "SMR", code2: "SM", name: "San Marino" },
  { code: "SRB", code2: "RS", name: "Srbija" },
  { code: "SLO", code2: "SI", name: "Slovenija" },
  { code: "SVK", code2: "SK", name: "Slovačka" },
  { code: "SWE", code2: "SE", name: "Švedska" },
  { code: "SUI", code2: "CH", name: "Švajcarska" },
  { code: "TUR", code2: "TR", name: "Turska" },
  { code: "UKR", code2: "UA", name: "Ukrajina" },

  // Azija
  { code: "AFG", code2: "AF", name: "Avganistan" },
  { code: "BAN", code2: "BD", name: "Bangladeš" },
  { code: "BHU", code2: "BT", name: "Butan" },
  { code: "BRN", code2: "BN", name: "Brunej" },
  { code: "CAM", code2: "KH", name: "Kambodža" },
  { code: "CHN", code2: "CN", name: "Kina" },
  { code: "HKG", code2: "HK", name: "Hong Kong" },
  { code: "INA", code2: "ID", name: "Indonezija" },
  { code: "IND", code2: "IN", name: "Indija" },
  { code: "IRI", code2: "IR", name: "Iran" },
  { code: "IRQ", code2: "IQ", name: "Irak" },
  { code: "JOR", code2: "JO", name: "Jordan" },
  { code: "JPN", code2: "JP", name: "Japan" },
  { code: "KAZ", code2: "KZ", name: "Kazahstan" },
  { code: "KGZ", code2: "KG", name: "Kirgizstan" },
  { code: "KOR", code2: "KR", name: "Južna Koreja" },
  { code: "KSA", code2: "SA", name: "Saudijska Arabija" },
  { code: "KUW", code2: "KW", name: "Kuvajt" },
  { code: "LAO", code2: "LA", name: "Laos" },
  { code: "LBN", code2: "LB", name: "Liban" },
  { code: "MAS", code2: "MY", name: "Malezija" },
  { code: "MDV", code2: "MV", name: "Maldivi" },
  { code: "MGL", code2: "MN", name: "Mongolija" },
  { code: "MYA", code2: "MM", name: "Mjanmar" },
  { code: "NEP", code2: "NP", name: "Nepal" },
  { code: "OMA", code2: "OM", name: "Oman" },
  { code: "PAK", code2: "PK", name: "Pakistan" },
  { code: "PHI", code2: "PH", name: "Filipini" },
  { code: "PRK", code2: "KP", name: "Severna Koreja" },
  { code: "QAT", code2: "QA", name: "Katar" },
  { code: "SGP", code2: "SG", name: "Singapur" },
  { code: "SRI", code2: "LK", name: "Šri Lanka" },
  { code: "SYR", code2: "SY", name: "Sirija" },
  { code: "TJK", code2: "TJ", name: "Tadžikistan" },
  { code: "TKM", code2: "TM", name: "Turkmenistan" },
  { code: "TLS", code2: "TL", name: "Istočni Timor" },
  { code: "TPE", code2: "TW", name: "Tajvan (Kineski Tajpej)" },
  { code: "UAE", code2: "AE", name: "Ujedinjeni Arapski Emirati" },
  { code: "UZB", code2: "UZ", name: "Uzbekistan" },
  { code: "VIE", code2: "VN", name: "Vijetnam" },
  { code: "YEM", code2: "YE", name: "Jemen" },

  // Afrika
  { code: "AGO", code2: "AO", name: "Angola" },
  { code: "ALG", code2: "DZ", name: "Alžir" },
  { code: "BEN", code2: "BJ", name: "Benin" },
  { code: "BOT", code2: "BW", name: "Bocvana" },
  { code: "BUR", code2: "BF", name: "Burkina Faso" },
  { code: "CAF", code2: "CF", name: "Centralna Afrička Republika" },
  { code: "CGO", code2: "CG", name: "Republika Kongo" },
  { code: "CHA", code2: "TD", name: "Čad" },
  { code: "CIV", code2: "CI", name: "Obala Slonovače" },
  { code: "CMR", code2: "CM", name: "Kamerun" },
  { code: "COD", code2: "CD", name: "DR Kongo" },
  { code: "COM", code2: "KM", name: "Komorska Ostrva" },
  { code: "CPV", code2: "CV", name: "Zelenortska Ostrva" },
  { code: "DJI", code2: "DJ", name: "Džibuti" },
  { code: "EGY", code2: "EG", name: "Egipat" },
  { code: "ERI", code2: "ER", name: "Eritreja" },
  { code: "ESW", code2: "SZ", name: "Esvatini" },
  { code: "ETH", code2: "ET", name: "Etiopija" },
  { code: "GAB", code2: "GA", name: "Gabon" },
  { code: "GAM", code2: "GM", name: "Gambija" },
  { code: "GBS", code2: "GW", name: "Gvineja Bisao" },
  { code: "GHA", code2: "GH", name: "Gana" },
  { code: "GUI", code2: "GN", name: "Gvineja" },
  { code: "GUQ", code2: "GQ", name: "Ekvatorijalna Gvineja" },
  { code: "KEN", code2: "KE", name: "Kenija" },
  { code: "LBA", code2: "LY", name: "Libija" },
  { code: "LES", code2: "LS", name: "Lesoto" },
  { code: "LIB", code2: "LR", name: "Liberija" },
  { code: "MAD", code2: "MG", name: "Madagaskar" },
  { code: "MAR", code2: "MA", name: "Maroko" },
  { code: "MAW", code2: "MW", name: "Malavi" },
  { code: "MLI", code2: "ML", name: "Mali" },
  { code: "MOZ", code2: "MZ", name: "Mozambik" },
  { code: "MRI", code2: "MU", name: "Mauricijus" },
  { code: "MTN", code2: "MR", name: "Mauritanija" },
  { code: "NAM", code2: "NA", name: "Namibija" },
  { code: "NIG", code2: "NE", name: "Niger" },
  { code: "NGR", code2: "NG", name: "Nigerija" },
  { code: "RSA", code2: "ZA", name: "Južnoafrička Republika" },
  { code: "RWA", code2: "RW", name: "Ruanda" },
  { code: "SEN", code2: "SN", name: "Senegal" },
  { code: "SEY", code2: "SC", name: "Sejšeli" },
  { code: "SLE", code2: "SL", name: "Sijera Leone" },
  { code: "SOM", code2: "SO", name: "Somalija" },
  { code: "SSD", code2: "SS", name: "Južni Sudan" },
  { code: "STP", code2: "ST", name: "Sveti Toma i Princip" },
  { code: "SUD", code2: "SD", name: "Sudan" },
  { code: "TAN", code2: "TZ", name: "Tanzanija" },
  { code: "TOG", code2: "TG", name: "Togo" },
  { code: "TUN", code2: "TN", name: "Tunis" },
  { code: "UGA", code2: "UG", name: "Uganda" },
  { code: "ZAM", code2: "ZM", name: "Zambija" },
  { code: "ZIM", code2: "ZW", name: "Zimbabve" },

  // Severna i Srednja Amerika + Karibi
  { code: "ANT", code2: "AG", name: "Antigva i Barbuda" },
  { code: "ARG", code2: "AR", name: "Argentina" },
  { code: "ARU", code2: "AW", name: "Aruba" },
  { code: "BAH", code2: "BS", name: "Bahami" },
  { code: "BAR", code2: "BB", name: "Barbados" },
  { code: "BER", code2: "BM", name: "Bermuda" },
  { code: "BOL", code2: "BO", name: "Bolivija" },
  { code: "BRA", code2: "BR", name: "Brazil" },
  { code: "CAY", code2: "KY", name: "Kajmanska Ostrva" },
  { code: "CHI", code2: "CL", name: "Čile" },
  { code: "COL", code2: "CO", name: "Kolumbija" },
  { code: "CRC", code2: "CR", name: "Kostarika" },
  { code: "CUB", code2: "CU", name: "Kuba" },
  { code: "DMA", code2: "DM", name: "Dominika" },
  { code: "DOM", code2: "DO", name: "Dominikanska Republika" },
  { code: "ECU", code2: "EC", name: "Ekvador" },
  { code: "ESA", code2: "SV", name: "Salvador" },
  { code: "GRN", code2: "GD", name: "Grenada" },
  { code: "GUA", code2: "GT", name: "Gvatemala" },
  { code: "GUY", code2: "GY", name: "Gvajana" },
  { code: "HAI", code2: "HT", name: "Haiti" },
  { code: "HON", code2: "HN", name: "Honduras" },
  { code: "JAM", code2: "JM", name: "Jamajka" },
  { code: "LCA", code2: "LC", name: "Sveta Lucija" },
  { code: "MEX", code2: "MX", name: "Meksiko" },
  { code: "NCA", code2: "NI", name: "Nikaragva" },
  { code: "PAN", code2: "PA", name: "Panama" },
  { code: "PAR", code2: "PY", name: "Paragvaj" },
  { code: "PER", code2: "PE", name: "Peru" },
  { code: "PUR", code2: "PR", name: "Portoriko" },
  { code: "SKN", code2: "KN", name: "Sveti Kits i Nevis" },
  { code: "SUR", code2: "SR", name: "Surinam" },
  { code: "TTO", code2: "TT", name: "Trinidad i Tobago" },
  { code: "URU", code2: "UY", name: "Urugvaj" },
  { code: "USA", code2: "US", name: "SAD" },
  { code: "VEN", code2: "VE", name: "Venecuela" },
  { code: "VIN", code2: "VC", name: "Sveti Vinsent i Grenadini" },

  // Okeanija
  { code: "ASA", code2: "AS", name: "Američka Samoa" },
  { code: "AUS", code2: "AU", name: "Australija" },
  { code: "COK", code2: "CK", name: "Kukova Ostrva" },
  { code: "FIJ", code2: "FJ", name: "Fidži" },
  { code: "FSM", code2: "FM", name: "Mikronezija" },
  { code: "GUM", code2: "GU", name: "Guam" },
  { code: "KIR", code2: "KI", name: "Kiribati" },
  { code: "MHL", code2: "MH", name: "Maršalska Ostrva" },
  { code: "NRU", code2: "NR", name: "Nauru" },
  { code: "NZL", code2: "NZ", name: "Novi Zeland" },
  { code: "PLW", code2: "PW", name: "Palau" },
  { code: "PNG", code2: "PG", name: "Papua Nova Gvineja" },
  { code: "SAM", code2: "WS", name: "Samoa" },
  { code: "SOL", code2: "SB", name: "Solomonska Ostrva" },
  { code: "TGA", code2: "TO", name: "Tonga" },
  { code: "TUV", code2: "TV", name: "Tuvalu" },
  { code: "VAN", code2: "VU", name: "Vanuatu" },

  // Istorijski (ISSF baza može ih imati)
  { code: "SCG", code2: "CS", name: "Srbija i Crna Gora" },
  { code: "YUG", code2: "YU", name: "Jugoslavija" },
  { code: "URS", code2: "SU", name: "SSSR" },
  { code: "TCH", code2: "CS", name: "Čehoslovačka" },
  { code: "GDR", code2: "DD", name: "Istočna Nemačka" },
  { code: "FRG", code2: "DE", name: "Zapadna Nemačka" },
];

async function main() {
  console.log(`Seeding ${ALL_COUNTRIES.length} countries...`);

  // Batch insert, upsert name/code2 if NOC code already exists
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < ALL_COUNTRIES.length; i += BATCH) {
    const batch = ALL_COUNTRIES.slice(i, i + BATCH);
    await db
      .insert(countries)
      .values(batch.map((c) => ({
        code: c.code,
        code2: c.code2 || null,
        name: c.name,
        nocCode: c.code, // nocCode = same as code (NOC code)
      })))
      .onConflictDoUpdate({
        target: countries.code,
        set: {
          name: sql`excluded.name`,
          code2: sql`excluded.code2`,
          nocCode: sql`excluded.noc_code`,
        },
      });
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${ALL_COUNTRIES.length}`);
  }
  console.log("\nCountries seeded.");

  // Backfill shooters.country_id via NOC code match
  console.log("Backfilling shooters.country_id...");
  const result = await client`
    UPDATE shooters s
    SET country_id = c.id
    FROM countries c
    WHERE s.nationality = c.code
      AND s.country_id IS NULL
  `;
  console.log(`  Updated ${result.count} shooters.`);

  console.log("Done.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  client.end();
  process.exit(1);
});
