import { db } from "@shootermarkt/db";
import { competitions, disciplines, olympicQuotaAllocations, olympicQuotas, results, shooters } from "@shootermarkt/db/schema";
import { DISCIPLINE_DISPLAY_ORDER } from "@shootermarkt/db/discipline-names";
import { asc, eq } from "drizzle-orm";

const GAMES = "LA2028";

export type QuotaHolder = { shooterId: number; firstName: string; lastName: string; nationality: string | null };

/** Jedno mesto (kvota) koje deli neko takmičenje u nekoj disciplini; `holder` je null dok nije dodeljeno. */
export type QuotaSlot = { competitionId: number; holder: QuotaHolder | null };

export type QuotaCompetition = {
  id: number;
  name: string;
  nameSr: string | null;
  nameEn: string | null;
  date: string;
  dateEnd: string | null;
  location: string | null;
  level: string;
  /** Discipline sa brojem mesta i koliko je već dodeljeno. */
  disciplines: Array<{ code: string; places: number; awarded: number }>;
};

export type QuotaDiscipline = { code: string; name: string; places: number; awarded: number; slots: QuotaSlot[] };

export type QuotaOverview = {
  competitions: QuotaCompetition[];
  disciplines: QuotaDiscipline[];
  places: number;
  awarded: number;
};

/** Pregled kvota za LA 2028: takmičenja koja ih dele i discipline sa mestima (popunjenim i otvorenim). */
export async function getQuotaOverview(): Promise<QuotaOverview> {
  const [allocations, awards] = await Promise.all([
    db
      .select({
        competitionId: competitions.id,
        name: competitions.name,
        nameSr: competitions.nameSr,
        nameEn: competitions.nameEn,
        date: competitions.date,
        dateEnd: competitions.dateEnd,
        location: competitions.location,
        level: competitions.level,
        code: disciplines.code,
        disciplineName: disciplines.name,
        places: olympicQuotaAllocations.places,
        disciplineId: olympicQuotaAllocations.disciplineId,
      })
      .from(olympicQuotaAllocations)
      .innerJoin(competitions, eq(competitions.id, olympicQuotaAllocations.competitionId))
      .innerJoin(disciplines, eq(disciplines.id, olympicQuotaAllocations.disciplineId))
      .where(eq(olympicQuotaAllocations.games, GAMES))
      .orderBy(asc(competitions.date)),
    db
      .select({
        competitionId: results.competitionId,
        disciplineId: results.disciplineId,
        shooterId: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        nationality: shooters.nationality,
        rank: results.finalRank,
        qualRank: results.qualRank,
      })
      .from(olympicQuotas)
      .innerJoin(results, eq(results.id, olympicQuotas.resultId))
      .innerJoin(shooters, eq(shooters.id, results.shooterId))
      .where(eq(olympicQuotas.games, GAMES)),
  ]);

  const competitionMap = new Map<number, QuotaCompetition>();
  const disciplineMap = new Map<string, QuotaDiscipline>();
  for (const a of allocations) {
    const holders = awards
      .filter((w) => w.competitionId === a.competitionId && w.disciplineId === a.disciplineId)
      // Najbolje plasirani prvi (plasman u finalu, pa u kvalifikacijama).
      .sort((x, y) => (x.rank ?? x.qualRank ?? Infinity) - (y.rank ?? y.qualRank ?? Infinity));
    const awarded = Math.min(holders.length, a.places);

    if (!competitionMap.has(a.competitionId)) {
      competitionMap.set(a.competitionId, { id: a.competitionId, name: a.name, nameSr: a.nameSr, nameEn: a.nameEn, date: a.date, dateEnd: a.dateEnd, location: a.location, level: a.level, disciplines: [] });
    }
    competitionMap.get(a.competitionId)!.disciplines.push({ code: a.code, places: a.places, awarded });

    const d = disciplineMap.get(a.code) ?? { code: a.code, name: a.disciplineName, places: 0, awarded: 0, slots: [] };
    d.places += a.places;
    d.awarded += awarded;
    for (let i = 0; i < a.places; i++) {
      const h = holders[i];
      d.slots.push({ competitionId: a.competitionId, holder: h ? { shooterId: h.shooterId, firstName: h.firstName, lastName: h.lastName, nationality: h.nationality } : null });
    }
    disciplineMap.set(a.code, d);
  }

  const order = (code: string) => { const i = DISCIPLINE_DISPLAY_ORDER.indexOf(code); return i < 0 ? 999 : i; };
  const ds = [...disciplineMap.values()].sort((a, b) => order(a.code) - order(b.code));
  const sortCodes = (c: QuotaCompetition) => c.disciplines.sort((a, b) => order(a.code) - order(b.code));
  return {
    competitions: [...competitionMap.values()].map((c) => (sortCodes(c), c)),
    disciplines: ds,
    places: ds.reduce((s, d) => s + d.places, 0),
    awarded: ds.reduce((s, d) => s + d.awarded, 0),
  };
}
