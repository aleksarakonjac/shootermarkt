import type { AgeCategory } from "@shootermarkt/db/pdf-import-types";

/** "2. meč · 22.01." is stored in Serbian; show "Match 2 · 22.01." on the English site. */
export function localizeMatchName(name: string, locale: string): string {
  return locale === "en" ? name.replace(/(\d+)\. meč/g, "Match $1") : name;
}

const CATEGORY_EN: Partial<Record<AgeCategory, string>> = {
  pionir: "Pioneer", kadet: "Cadet (U16)", mladji_junior: "Younger Junior (U18)", mladji_senior: "Younger Senior (U23)",
};

export function categoryLabel(category: AgeCategory, sr: string, locale: string): string {
  return (locale === "en" && CATEGORY_EN[category]) || sr;
}
