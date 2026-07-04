import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { competitions } from "@/lib/db/schema";

export interface CompetitionCardData {
  id: number;
  name: string;
  date: string;
  dateEnd: string | null;
  location: string | null;
  level: string;
}

export async function resolveCompetition(id: number): Promise<CompetitionCardData | null> {
  const row = await db.query.competitions.findFirst({ where: eq(competitions.id, id) });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    dateEnd: row.dateEnd,
    location: row.location,
    level: row.level,
  };
}
