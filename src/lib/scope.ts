import { inArray, or, sql } from 'drizzle-orm';
import { competitions } from '@/lib/db/schema';

export type Scope = 'srb' | 'issf';
export const VALID_SCOPES: readonly Scope[] = ['srb', 'issf'] as const;
export const DEFAULT_SCOPE: Scope = 'srb';

export const ISSF_LEVELS = ['continental', 'world', 'olympic'] as const;

export function buildCompetitionScopeFilter(scope: Scope) {
  if (scope === 'issf') {
    return inArray(competitions.level, [...ISSF_LEVELS]);
  }

  // Srbija includes domestic events plus ESC and ISSF events. The latter are
  // deliberately selected by their source metadata, rather than every event
  // at a continental/world/olympic level.
  return or(
    sql`${competitions.countryId} = (SELECT id FROM countries WHERE noc_code = 'SRB')`,
    sql`'sss' = ANY(${competitions.tags})`,
    sql`${competitions.organizer} = 'SSS'`,
    sql`'esc' = ANY(${competitions.tags})`,
    sql`${competitions.organizer} = 'ESC'`,
    sql`${competitions.level} IN ('world', 'olympic')`,
    sql`'issf' = ANY(${competitions.tags})`,
    sql`${competitions.organizer} = 'ISSF'`,
  );
}

export function buildShooterScopeFilter(_scope: Scope) {
  return undefined;
}
