import { db } from "@shootermarkt/db";
import { competitions, disciplines, olympicQuotaAllocations, olympicQuotas, results, shooters } from "@shootermarkt/db/schema";
import { DISCIPLINE_DISPLAY_ORDER } from "@shootermarkt/db/discipline-names";
import { asc, eq, isNotNull } from "drizzle-orm";

const GAMES = "LA2028";

/** Odakle dolaze kvote: takmičenje (osvaja se nastupom) ili izvori koji se dodeljuju ručno kad se saznaju. */
export type QuotaSourceKind = "competition" | "ranking" | "host" | "universality";

export type QuotaHolder = {
  shooterId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  avatarUrl: string | null;
  /** Plasman po kom je kvota osvojena (u finalu ili u kvalifikacijama, prema osnovi deobe); null kod ručno dodeljenih. */
  rank: number | null;
};

/** Jedno mesto (kvota) jednog izvora u jednoj disciplini; `holder` je null dok nije dodeljeno. */
export type QuotaSlot = { sourceKey: string; basis: "final" | "qualification"; holder: QuotaHolder | null };

export type QuotaSource = {
  /** "c13" za takmičenje, inače "ranking" | "host" | "universality". */
  key: string;
  kind: QuotaSourceKind;
  competitionId: number | null;
  name: string | null;
  nameSr: string | null;
  nameEn: string | null;
  location: string | null;
  locationSr: string | null;
  locationEn: string | null;
  level: string | null;
  /** Početak takmičenja ili datum izvora (npr. zaključenje rang-liste); null za domaćina i univerzalna mesta. */
  date: string | null;
  dateEnd: string | null;
  disciplines: Array<{ code: string; places: number; awarded: number; slots: QuotaSlot[] }>;
};

export type QuotaDiscipline = { code: string; name: string; places: number; awarded: number; slots: QuotaSlot[] };

/** Kvote jedne države: ukupno i po disciplini. */
export type QuotaCountry = { nationality: string; total: number; byDiscipline: Array<{ code: string; count: number }> };

export type QuotaOverview = {
  /** Takmičenja po datumu, pa rang-lista, domaćin, univerzalnost. */
  sources: QuotaSource[];
  disciplines: QuotaDiscipline[];
  countries: QuotaCountry[];
  places: number;
  awarded: number;
};

const KIND_ORDER: Record<QuotaSourceKind, number> = { competition: 0, ranking: 1, host: 2, universality: 3 };

/** Pregled kvota za LA 2028: izvori kvota (takmičenja, rang-lista, domaćin, univerzalnost) i discipline sa mestima (popunjenim i otvorenim). */
export async function getQuotaOverview(): Promise<QuotaOverview> {
  const [allocations, resultAwards, manualAwards] = await Promise.all([
    db
      .select({
        allocationId: olympicQuotaAllocations.id,
        kind: olympicQuotaAllocations.kind,
        allocationDate: olympicQuotaAllocations.date,
        competitionId: competitions.id,
        name: competitions.name,
        nameSr: competitions.nameSr,
        nameEn: competitions.nameEn,
        date: competitions.date,
        dateEnd: competitions.dateEnd,
        location: competitions.location,
        locationSr: competitions.locationSr,
        locationEn: competitions.locationEn,
        level: competitions.level,
        code: disciplines.code,
        disciplineName: disciplines.name,
        places: olympicQuotaAllocations.places,
        disciplineId: olympicQuotaAllocations.disciplineId,
        basis: olympicQuotaAllocations.basis,
      })
      .from(olympicQuotaAllocations)
      .leftJoin(competitions, eq(competitions.id, olympicQuotaAllocations.competitionId))
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
        avatarUrl: shooters.avatarUrl,
        rank: results.finalRank,
        qualRank: results.qualRank,
      })
      .from(olympicQuotas)
      .innerJoin(results, eq(results.id, olympicQuotas.resultId))
      .innerJoin(shooters, eq(shooters.id, results.shooterId))
      .where(eq(olympicQuotas.games, GAMES)),
    db
      .select({
        allocationId: olympicQuotas.allocationId,
        shooterId: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        nationality: shooters.nationality,
        avatarUrl: shooters.avatarUrl,
      })
      .from(olympicQuotas)
      .innerJoin(shooters, eq(shooters.id, olympicQuotas.shooterId))
      .where(isNotNull(olympicQuotas.allocationId)),
  ]);

  const sourceMap = new Map<string, QuotaSource>();
  const disciplineMap = new Map<string, QuotaDiscipline>();
  for (const a of allocations) {
    const kind = (a.kind as QuotaSourceKind) ?? "competition";
    const key = kind === "competition" ? `c${a.competitionId}` : kind;
    const basis = a.basis === "qualification" ? "qualification" : "final";

    let holders: QuotaHolder[];
    if (kind === "competition") {
      holders = resultAwards
        .filter((w) => w.competitionId === a.competitionId && w.disciplineId === a.disciplineId)
        // Najbolje plasirani prvi (plasman u finalu, pa u kvalifikacijama).
        .sort((x, y) => (x.rank ?? x.qualRank ?? Infinity) - (y.rank ?? y.qualRank ?? Infinity))
        .map((h) => ({ shooterId: h.shooterId, firstName: h.firstName, lastName: h.lastName, nationality: h.nationality, avatarUrl: h.avatarUrl, rank: (basis === "qualification" ? h.qualRank : h.rank) ?? null }));
    } else {
      holders = manualAwards
        .filter((w) => w.allocationId === a.allocationId)
        .map((h) => ({ shooterId: h.shooterId, firstName: h.firstName, lastName: h.lastName, nationality: h.nationality, avatarUrl: h.avatarUrl, rank: null }));
    }
    const awarded = Math.min(holders.length, a.places);
    const slots: QuotaSlot[] = Array.from({ length: a.places }, (_, i) => ({ sourceKey: key, basis, holder: holders[i] ?? null }));

    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        key, kind, competitionId: a.competitionId,
        name: a.name, nameSr: a.nameSr, nameEn: a.nameEn,
        location: a.location, locationSr: a.locationSr, locationEn: a.locationEn,
        level: a.level, date: a.date ?? a.allocationDate, dateEnd: a.dateEnd, disciplines: [],
      });
    }
    const src = sourceMap.get(key)!;
    if (!src.date && a.allocationDate) src.date = a.allocationDate;
    src.disciplines.push({ code: a.code, places: a.places, awarded, slots });

    const d = disciplineMap.get(a.code) ?? { code: a.code, name: a.disciplineName, places: 0, awarded: 0, slots: [] };
    d.places += a.places;
    d.awarded += awarded;
    d.slots.push(...slots);
    disciplineMap.set(a.code, d);
  }

  const order = (code: string) => { const i = DISCIPLINE_DISPLAY_ORDER.indexOf(code); return i < 0 ? 999 : i; };
  const ds = [...disciplineMap.values()].sort((a, b) => order(a.code) - order(b.code));
  for (const src of sourceMap.values()) src.disciplines.sort((a, b) => order(a.code) - order(b.code));
  const sources = [...sourceMap.values()].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.date ?? "9999").localeCompare(b.date ?? "9999"),
  );

  const countryMap = new Map<string, QuotaCountry>();
  for (const d of ds) {
    for (const slot of d.slots) {
      const nat = slot.holder?.nationality;
      if (!nat) continue;
      const c = countryMap.get(nat) ?? { nationality: nat, total: 0, byDiscipline: [] };
      c.total++;
      const entry = c.byDiscipline.find((x) => x.code === d.code);
      if (entry) entry.count++;
      else c.byDiscipline.push({ code: d.code, count: 1 });
      countryMap.set(nat, c);
    }
  }

  return {
    sources,
    disciplines: ds,
    countries: [...countryMap.values()].sort((a, b) => b.total - a.total || a.nationality.localeCompare(b.nationality)),
    places: ds.reduce((s, d) => s + d.places, 0),
    awarded: ds.reduce((s, d) => s + d.awarded, 0),
  };
}
