import { sql } from "drizzle-orm";
import { countries } from "@shootermarkt/db/schema";

/** Country display name for the site language; falls back to the legacy `name`. */
export const countryNameSql = (locale: string) =>
  locale === "en"
    ? sql<string | null>`coalesce(${countries.nameEn}, ${countries.name})`
    : sql<string | null>`coalesce(${countries.nameSr}, ${countries.name})`;
