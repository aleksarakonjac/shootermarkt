import { eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { uploadAvatarFromUrl } from "@shootermarkt/db/upload-avatar";
import { fetchAthleteProfile, inferApparatus, searchAthletes } from "./adapter";

export async function importIssfNation(noc: string, signal?: AbortSignal) {
  const athletes = await searchAthletes(noc, "", 0, signal);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const seen = new Set<string>();
  const deduped = athletes
    .filter((a) => a.nationCode === noc && a.firstName?.trim() && a.familyName?.trim() && a.issfId)
    .filter((a) => {
      if (seen.has(a.issfId)) return false;
      seen.add(a.issfId);
      return true;
    });
  if (!deduped.length) return { inserted: 0, skipped: athletes.length, total: athletes.length };

  const profiles = [] as Awaited<ReturnType<typeof fetchAthleteProfile>>[];
  for (let i = 0; i < deduped.length; i += 10) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    profiles.push(...await Promise.all(deduped.slice(i, i + 10).map((a) => fetchAthleteProfile(a.issfId, signal))));
  }

  const profileMap = new Map(profiles.map((profile, i) => [deduped[i].issfId, profile]));
  const values = deduped.map((a) => {
    const profile = profileMap.get(a.issfId) ?? {};
    const birthday = profile.birthday ?? a.birthday;
    const birthDate = birthday ? birthday.slice(0, 10) : null;
    return {
      firstName: a.firstName.trim(), lastName: a.familyName.trim(), nationality: a.nationCode || null,
      gender: a.gender === "Male" ? "M" : a.gender === "Female" ? "F" : null,
      birthYear: birthDate ? new Date(birthDate).getFullYear() : null, birthDate,
      apparatus: inferApparatus(profile.events), issfId: a.issfId, verified: false, createdBySelf: false,
    };
  });
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const inserted = await db.insert(shooters).values(values).onConflictDoNothing().returning({ id: shooters.id, issfId: shooters.issfId });

  if (!signal?.aborted) {
    const portraits = new Map(deduped.map((a) => [a.issfId, a.portraitUrl]));
    await Promise.allSettled(inserted.map(async (shooter) => {
      const portraitUrl = shooter.issfId ? portraits.get(shooter.issfId) : undefined;
      if (!portraitUrl || !shooter.issfId) return;
      const avatarUrl = await uploadAvatarFromUrl(shooter.issfId, portraitUrl);
      await db.update(shooters).set({ avatarUrl }).where(eq(shooters.id, shooter.id));
    }));
  }

  return { inserted: inserted.length, skipped: deduped.length - inserted.length, total: deduped.length };
}
