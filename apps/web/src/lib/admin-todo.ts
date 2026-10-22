import { competitions, mixedTeamResults, results } from "@shootermarkt/db/schema";
import { and, gte, inArray, isNull, lte, sql } from "drizzle-orm";

const DAY = 86_400_000;
export const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

const ISSF_LEVELS = ["international", "continental", "world", "olympic"] as const;

// Correlated subqueries: column refs are written table-qualified — drizzle renders bare ${col} unqualified in a
// single-table select, which would bind both sides to the subquery's own table.
export const hasResults = sql<boolean>`(exists (select 1 from ${results} where ${results}.competition_id = "competitions"."id")
  or exists (select 1 from ${mixedTeamResults} where ${mixedTeamResults}.competition_id = "competitions"."id"))`;
export const endDate = sql`coalesce(${competitions.dateEnd}, ${competitions.date})`;

/** Finished in the last 60 days with nothing imported yet. */
export const unresolvedWhere = () => and(gte(endDate, isoDay(-60)), lte(endDate, isoDay(-1)), sql`not ${hasResults}`);

/** International events in the next 30 days that can't get live results (no SIUS UUID, no ISSF id). */
export const missingSourceWhere = () =>
  and(
    gte(endDate, isoDay(0)),
    lte(competitions.date, isoDay(30)),
    inArray(competitions.level, [...ISSF_LEVELS]),
    isNull(competitions.siusId),
    isNull(competitions.issfId),
  );
