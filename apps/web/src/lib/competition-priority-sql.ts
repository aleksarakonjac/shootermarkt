import { competitions } from "@shootermarkt/db/schema";
import { sql } from "drizzle-orm";
import { FOCUS_300M_OFFSET, FOCUS_AGE_OFFSET, FOCUS_PRIORITY_MAX } from "./competition-priority";

/**
 * SQL verzija `effectiveFocusPriority` bez kategorija iz rasporeda (kao "auto N" u admin listi):
 * ručni override, inače baza po nivou/tipu + pomak za starosnu kategoriju + 300m.
 * Mora da prati `baseTier` / `defaultFocusPriority` iz competition-priority.ts.
 */
export function effectiveFocusPrioritySql() {
  const base = sql`case ${competitions.level}
    when 'world' then case when ${competitions.eventType} = 'championship' then 1 else 2 end
    when 'continental' then case when ${competitions.eventType} = 'championship' then 3 else 5 end
    when 'international' then case when ${competitions.eventType} in ('champions_league', 'grand_prix') then 6 else 7 end
    when 'national' then 8
    when 'regional' then 9
    else 10 end`;
  const ageCases = Object.entries(FOCUS_AGE_OFFSET)
    .filter(([, offset]) => offset !== 0)
    .map(([category, offset]) => sql`when ${category} then ${sql.raw(String(offset))}`);
  const age = sql`case ${competitions.ageCategory}::text ${sql.join(ageCases, sql` `)} else 0 end`;
  const distance = sql`case when ${competitions.name} ~* '(^|[^0-9])300 ?m([^a-z0-9_]|$)' then ${sql.raw(String(FOCUS_300M_OFFSET))} else 0 end`;
  return sql<number>`coalesce(${competitions.focusPriority}, case when ${competitions.level} = 'olympic' then 0
    else least(${sql.raw(String(FOCUS_PRIORITY_MAX))}, ${base} + ${age} + ${distance}) end)`;
}
