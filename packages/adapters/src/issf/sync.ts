/**
 * ISSF ↔ naša baza: lookup po imenu, povezivanje i dopuna profila.
 *
 * - lookupIssfAthletes: kandidati iz ISSF pretrage za (ime, prezime, NOC), rangirani
 * - applyIssfProfile:   upiše issfId strelcu i popuni SAMO prazna polja (+ avatar)
 * - autoLinkShooter:    za strelca bez issfId — poveže samo ako je jedinstven tačan pogodak
 */
import { and, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { issfRefreshJobs, shooters } from "@shootermarkt/db/schema";
import { editDistance, foldName } from "@shootermarkt/db/name-match";
import { NoAvatarError, uploadAvatarFromUrlRaw } from "@shootermarkt/db/upload-avatar-raw";
import { fetchAthleteProfile, inferApparatus, searchRaw, type ISSFAthlete } from "./adapter";

export type IssfMatch = "exact" | "close" | "weak";

export interface IssfCandidate {
  issfId: string;
  firstName: string;
  lastName: string;
  nationCode: string;
  gender: "M" | "F" | null;
  birthYear: number | null;
  portraitUrl: string | null;
  match: IssfMatch;
  /** Naš strelac koji već ima ovaj issfId (ako postoji) */
  existingShooterId: number | null;
}

/** ISSF pretraga je ASCII: "Đorđević" → "Dordevic". */
export function issfAscii(s: string): string {
  return s.replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D")).normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Reči imena ("Al-Harbi" → al, harbi), svedene na fold ključ. */
export function nameTokens(...parts: string[]): string[] {
  return parts.join(" ").split(/[\s\-'’.]+/).map(foldName).filter(Boolean);
}

/**
 * Višečlana imena (npr. bliski istok): izvor "Mohammed Al-Harbi", ISSF "MOHAMMED ALI" / "AL HARBI".
 * Podela na ime/prezime se razlikuje, pa se porede reči celog imena bez obzira na redosled.
 * exact = isti skup reči (ili isto ime spojeno bez razmaka); close = sve reči kraćeg imena
 * su u dužem, a bar dve reči se poklapaju.
 */
function rankTokens(first: string, last: string, c: Pick<ISSFAthlete, "firstName" | "familyName">): IssfMatch | null {
  const a = nameTokens(first, last);
  const b = nameTokens(c.firstName ?? "", c.familyName ?? "");
  if (a.length < 2 || b.length < 2) return null;
  const setA = new Set(a), setB = new Set(b);
  const shared = [...setA].filter((t) => setB.has(t)).length;
  if (shared === setA.size && shared === setB.size) return "exact";
  if (a.join("") === b.join("") || [...a].sort().join("") === [...b].sort().join("")) return "exact";
  if (shared >= 2 && (shared === setA.size || shared === setB.size)) return "close";
  return null;
}

export function rankMatch(first: string, last: string, c: Pick<ISSFAthlete, "firstName" | "familyName">): IssfMatch {
  const lastEq = foldName(last) === foldName(c.familyName ?? "");
  if (!lastEq) return rankTokens(first, last, c) ?? "weak";
  const fa = foldName(first), fb = foldName(c.firstName ?? "");
  if (fa === fb) return "exact";
  return editDistance(fa, fb) <= 2 || fa.startsWith(fb) || fb.startsWith(fa) ? "close" : "weak";
}

const ORDER: Record<IssfMatch, number> = { exact: 0, close: 1, weak: 2 };

export async function lookupIssfAthletes(first: string, last: string, noc?: string | null): Promise<IssfCandidate[]> {
  const lastAscii = issfAscii(last);
  const lastVariants = [...new Set([lastAscii, lastAscii.replace(/dj/gi, "d")])];
  const nocQ = noc && /^[A-Z]{3}$/.test(noc) ? noc : null;

  // NOC + prezime je najuži upit; bez NOC-a kao fallback (pogrešan/klupski NOC u izvoru)
  const queries = [
    ...(nocQ ? lastVariants.map((l) => `${nocQ} ${l}`) : []),
    ...lastVariants.map((l) => `${l} ${issfAscii(first)}`.trim()),
  ];
  // Višečlana imena: ISSF može imati drugačiju podelu ime/prezime — traži i po najdužoj reči
  const tokens = nameTokens(issfAscii(first), lastAscii);
  if (tokens.length > 2) {
    const longest = [...tokens].sort((x, y) => y.length - x.length)[0];
    queries.push(...(nocQ ? [`${nocQ} ${longest}`] : []), longest);
  }

  const found = new Map<string, ISSFAthlete>();
  for (const q of queries) {
    const batch = await searchRaw(q);
    for (const a of batch) if (a.issfId) found.set(a.issfId, a);
    if ([...found.values()].some((a) => rankMatch(first, last, a) === "exact")) break;
  }
  if (!found.size) return [];

  const ids = [...found.keys()];
  const existing = await db.select({ id: shooters.id, issfId: shooters.issfId }).from(shooters).where(inArray(shooters.issfId, ids));
  const existingMap = new Map(existing.map((e) => [e.issfId, e.id]));

  return [...found.values()]
    .map((a): IssfCandidate => ({
      issfId: a.issfId,
      firstName: a.firstName,
      lastName: a.familyName,
      nationCode: a.nationCode,
      gender: a.gender === "Male" ? "M" : a.gender === "Female" ? "F" : null,
      birthYear: a.birthday ? Number(a.birthday.slice(0, 4)) : null,
      portraitUrl: a.portraitUrl ?? null,
      match: rankMatch(first, last, a),
      existingShooterId: existingMap.get(a.issfId) ?? null,
    }))
    .filter((c) => c.match !== "weak" || found.size <= 10)
    .sort((a, b) => ORDER[a.match] - ORDER[b.match] || Number(b.nationCode === nocQ) - Number(a.nationCode === nocQ))
    .slice(0, 10);
}

export class IssfConflictError extends Error {
  constructor(public shooterId: number) { super(`ISSF ID već pripada strelcu #${shooterId}`); }
}

/**
 * Poveže strelca sa issfId i popuni prazna polja sa ISSF profila.
 * Ne prepisuje ono što admin već ima. Vraća listu promenjenih polja.
 */
export async function applyIssfProfile(shooterId: number, issfId: string): Promise<string[]> {
  const [shooter] = await db.select().from(shooters).where(eq(shooters.id, shooterId));
  if (!shooter) throw new Error(`Strelac #${shooterId} ne postoji`);
  if (shooter.issfId && shooter.issfId !== issfId) throw new Error(`Strelac već ima drugi ISSF ID (${shooter.issfId})`);

  const [owner] = await db.select({ id: shooters.id }).from(shooters).where(eq(shooters.issfId, issfId));
  if (owner && owner.id !== shooterId) throw new IssfConflictError(owner.id);

  const profile = await fetchAthleteProfile(issfId);
  if (!profile.issfId) throw new Error("ISSF profil nije dostupan");

  const update: Partial<typeof shooters.$inferInsert> = { issfSyncedAt: new Date() };
  if (!shooter.issfId) update.issfId = issfId;
  const birthDate = profile.birthday?.slice(0, 10) ?? null;
  // ISSF često ima samo godinu (YYYY-01-01) — ne prepisuj pravi datum
  if (birthDate && !shooter.birthDate) update.birthDate = birthDate;
  if (birthDate && !shooter.birthYear) update.birthYear = Number(birthDate.slice(0, 4));
  const gender = profile.gender === "Male" ? "M" : profile.gender === "Female" ? "F" : null;
  if (gender && !shooter.gender) update.gender = gender;
  if (profile.nationCode && !shooter.nationality) update.nationality = profile.nationCode;
  const apparatus = inferApparatus(profile.events);
  if (apparatus && !shooter.apparatus) update.apparatus = apparatus;

  if (!shooter.avatarUrl && profile.portraitUrl) {
    try {
      update.avatarUrl = await uploadAvatarFromUrlRaw(issfId, profile.portraitUrl);
    } catch (e) {
      if (!(e instanceof NoAvatarError)) console.warn(`[issf-sync] avatar ${issfId}:`, e);
    }
  }

  await db.update(shooters).set(update).where(eq(shooters.id, shooterId));
  return Object.keys(update).filter((k) => k !== "issfSyncedAt");
}

/**
 * Auto-link za strelca bez issfId (npr. kreiran iz live SIUS cron-a).
 * Povezuje samo kada postoji TAČNO JEDAN tačan pogodak koji nije zauzet i
 * ne protivreči nacionalnosti ni godištu. Inače ništa — admin ručno.
 */
export async function autoLinkShooter(s: { id: number; firstName: string; lastName: string; nationality: string | null; birthYear: number | null }): Promise<string[] | null> {
  // Bez nacionalnosti nema dovoljno signala za automatsko povezivanje — samo ručno
  if (!s.nationality) return null;
  const candidates = await lookupIssfAthletes(s.firstName, s.lastName, s.nationality);
  const exact = candidates.filter((c) =>
    c.match === "exact" &&
    !c.existingShooterId &&
    c.nationCode === s.nationality &&
    (!s.birthYear || !c.birthYear || c.birthYear === s.birthYear)
  );
  if (exact.length !== 1) return null;
  return applyIssfProfile(s.id, exact[0].issfId);
}

/**
 * Strelci kojima refresh može nešto da donese: bez issfId (auto-link) ili sa
 * praznim poljem koje ISSF popunjava. Popunjeni se preskaču — fill-only-null.
 * `before`: ne diraj one koji su već obrađeni posle početka ovog job-a.
 */
export function needsIssfRefresh(before: Date): SQL {
  return and(
    or(isNull(shooters.issfSyncedAt), lt(shooters.issfSyncedAt, before)),
    or(isNull(shooters.issfId), isNull(shooters.avatarUrl), isNull(shooters.birthDate), isNull(shooters.apparatus), isNull(shooters.gender)),
  )!;
}

/** Jedan strelac u refresh job-u. Greške se gutaju — job ide dalje. */
export async function refreshShooter(s: typeof shooters.$inferSelect): Promise<"updated" | "linked" | "none"> {
  try {
    if (s.issfId) return (await applyIssfProfile(s.id, s.issfId)).length ? "updated" : "none";
    return (await autoLinkShooter(s)) ? "linked" : "none";
  } catch (e) {
    console.warn(`[issf-refresh] shooter ${s.id}:`, e instanceof Error ? e.message : e);
    return "none";
  } finally {
    await db.update(shooters).set({ issfSyncedAt: new Date() }).where(eq(shooters.id, s.id));
  }
}

/**
 * Kreira refresh job (ili vrati aktivan — nikad dva paralelno).
 * Pozivalac šalje "issf-refresh/queued" samo kada je created = true.
 */
export async function createIssfRefreshJob(): Promise<{ id: number; total: number; created: boolean } | null> {
  const [active] = await db.select({ id: issfRefreshJobs.id, total: issfRefreshJobs.total }).from(issfRefreshJobs)
    .where(inArray(issfRefreshJobs.status, ["queued", "processing"])).limit(1);
  if (active) return { ...active, created: false };
  // JS vreme i za createdAt i za issfSyncedAt — poređenje u needsIssfRefresh bez clock skew-a
  const now = new Date();
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(shooters).where(needsIssfRefresh(now));
  if (!count) return null;
  const [job] = await db.insert(issfRefreshJobs).values({ total: count, createdAt: now }).returning({ id: issfRefreshJobs.id });
  return { id: job.id, total: count, created: true };
}
