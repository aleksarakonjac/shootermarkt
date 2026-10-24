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
  /** Poklapanje samo preko ranijeg prezimena (ime + nacija), bez našeg prezimena kao potvrde */
  renamed: boolean;
  /** Naš strelac koji već ima ovaj issfId (ako postoji) */
  existingShooterId: number | null;
}

// Slova koja NFD ne razlaže na osnovu + akcenat
const NON_DECOMPOSING: Record<string, string> = { đ: "d", Đ: "D", ı: "i", ß: "ss", ẞ: "SS", ł: "l", Ł: "L", ø: "o", Ø: "O", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE", þ: "th", Þ: "TH", ð: "d", Ð: "D" };
const GERMAN: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "AE", Ö: "OE", Ü: "UE" };

/**
 * ISSF pretraga je ASCII: "Đorđević" → "Dordevic", "Hajı" → "Haji", "Weiß" → "Weiss".
 * `german`: ä/ö/ü → ae/oe/ue ("Jäggi" → "Jaeggi") — ISSF piše i tako, i to ne samo za GER
 * (HUN ima i TOROK i TOEROEK), pa se probaju obe varijante.
 */
export function issfAscii(s: string, german = false): string {
  return (german ? s.replace(/[äöüÄÖÜ]/g, (c) => GERMAN[c]) : s)
    .replace(/[đĐıßẞłŁøØæÆœŒþÞðÐ]/g, (c) => NON_DECOMPOSING[c])
    .normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Ime u obe ASCII varijante (bez duplikata kada nema umlauta). */
function asciiVariants(first: string, last: string): { first: string; last: string }[] {
  const plain = { first: issfAscii(first), last: issfAscii(last) };
  const german = { first: issfAscii(first, true), last: issfAscii(last, true) };
  return plain.first === german.first && plain.last === german.last ? [plain] : [plain, german];
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

/**
 * `viaLastName`: ISSF je kandidata vratio na upit po našem prezimenu. Ako tog prezimena
 * nema u njegovom imenu, ISSF ga je našao po ranijem prezimenu (udaja: pretraga
 * "HAVRAN Aleksandra" → "Aleksandra STOJADINOVIC") — onda odlučuje samo ime.
 */
export function rankMatch(first: string, last: string, c: Pick<ISSFAthlete, "firstName" | "familyName">, viaLastName = false): IssfMatch {
  const variants = asciiVariants(first, last);
  const ranks = variants.map((v) => rankAscii(v.first, v.last, c));
  if (viaLastName) ranks.push(...variants.map((v) => rankRenamed(v.first, v.last, c)));
  return ranks.sort((a, b) => ORDER[a] - ORDER[b])[0];
}

function rankRenamed(first: string, last: string, c: Pick<ISSFAthlete, "firstName" | "familyName">): IssfMatch {
  const fLast = foldName(last);
  if (!fLast || foldName(`${c.firstName ?? ""}${c.familyName ?? ""}`).includes(fLast)) return "weak";
  const fa = foldName(first), fb = foldName(c.firstName ?? "");
  if (fa === fb) return "exact";
  return fa && fb && (fa.startsWith(fb) || fb.startsWith(fa)) ? "close" : "weak";
}

function rankAscii(first: string, last: string, c: Pick<ISSFAthlete, "firstName" | "familyName">): IssfMatch {
  const lastEq = foldName(last) === foldName(c.familyName ?? "");
  if (!lastEq) return rankTokens(first, last, c) ?? "weak";
  const fa = foldName(first), fb = foldName(c.firstName ?? "");
  if (fa === fb) return "exact";
  return editDistance(fa, fb) <= 2 || fa.startsWith(fb) || fb.startsWith(fa) ? "close" : "weak";
}

const ORDER: Record<IssfMatch, number> = { exact: 0, close: 1, weak: 2 };

export async function lookupIssfAthletes(first: string, last: string, noc?: string | null): Promise<IssfCandidate[]> {
  const variants = asciiVariants(first, last).flatMap((v) => [v, { ...v, last: v.last.replace(/dj/gi, "d") }]);
  const nocQ = noc && /^[A-Z]{3}$/.test(noc) ? noc : null;

  // NOC + prezime je najuži upit; bez NOC-a kao fallback (pogrešan/klupski NOC u izvoru, npr. BAY)
  const queries = [...new Set([
    ...(nocQ ? variants.map((v) => `${nocQ} ${v.last}`) : []),
    ...variants.map((v) => `${v.last} ${v.first}`.trim()),
  ])];
  const lastNameQueries = queries.length;
  // Višečlana imena: ISSF može imati drugačiju podelu ime/prezime — traži i po najdužoj reči
  const tokens = nameTokens(variants[0].first, variants[0].last);
  if (tokens.length > 2) {
    const longest = [...tokens].sort((x, y) => y.length - x.length)[0];
    queries.push(...(nocQ ? [`${nocQ} ${longest}`] : []), longest);
  }

  const found = new Map<string, ISSFAthlete>();
  // Samo pogoci upita sa prezimenom mogu biti "promenjeno prezime" — upit po najdužoj reči
  // može biti po imenu i vratio bi svakoga sa tim imenom
  // + ista nacija: ISSF pretraga je labava ("MARIAN Ana" vrati i "Ana Beatriz DA SILVA BRA")
  const viaLast = new Set<string>();
  const nocOk = (a: ISSFAthlete) => !nocQ || nocQ === "AIN" || a.nationCode === nocQ;
  const rank = (a: ISSFAthlete) => rankMatch(first, last, a, viaLast.has(a.issfId) && nocOk(a));
  for (const [i, q] of queries.entries()) {
    const batch = await searchRaw(q);
    for (const a of batch) if (a.issfId) {
      found.set(a.issfId, a);
      if (i < lastNameQueries) viaLast.add(a.issfId);
    }
    if ([...found.values()].some((a) => rank(a) === "exact")) break;
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
      match: rank(a),
      renamed: rank(a) !== rankMatch(first, last, a),
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
 * ISSF prezime koje nema nijednu reč zajedničku sa našim imenom (ni u jednoj ASCII varijanti) je
 * promenjeno prezime — čuva se kao alias da bi matchShooter našao strelca i u rezultatima
 * pod novim prezimenom. Različit zapis (JÄGGI/JAEGGI, Al-Harbi/AL HARBI) ili zamenjeno
 * ime/prezime ("Prodiashvili SALOME") nije alias.
 */
export function renamedAlias(s: { firstName: string; lastName: string; previousLastNames: string[] | null }, issfFamilyName: string | undefined): string | null {
  if (!issfFamilyName?.trim()) return null;
  const ours = new Set([s.firstName, s.lastName, ...(s.previousLastNames ?? [])].flatMap((n) => [...nameTokens(issfAscii(n)), ...nameTokens(issfAscii(n, true))]));
  return nameTokens(issfFamilyName).some((t) => ours.has(t)) ? null : issfFamilyName.trim();
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
  const alias = renamedAlias(shooter, profile.familyName);
  if (alias) update.previousLastNames = [...(shooter.previousLastNames ?? []), alias];

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
    // Bez nadzora promena prezimena traži i isto godište sa obe strane
    (!c.renamed || (!!s.birthYear && c.birthYear === s.birthYear)) &&
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
