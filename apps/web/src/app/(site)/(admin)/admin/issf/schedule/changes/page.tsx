import { db } from "@shootermarkt/db";
import { competitions, competitionScheduleChanges, disciplines } from "@shootermarkt/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { AckButton } from "./ack-button";
import { SyncNowButton } from "./sync-now-button";
import { TimezoneForm } from "./timezone-form";

export const metadata: Metadata = { title: "Admin · Izmene satnice" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { changed: "Pomereno", added: "Dodato", removed: "Uklonjeno", tz_missing: "Nepoznata vremenska zona" };

function fmt(d: Date | null, tz: string) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("sr-Latn", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
const range = (a: Date | null, b: Date | null, tz: string) => (a ? `${fmt(a, tz)}${b ? `–${fmt(b, tz).slice(-5)}` : ""}` : "—");

export default async function ScheduleChangesPage() {
  const rows = await db
    .select({ c: competitionScheduleChanges, name: competitions.name, location: competitions.location, tz: competitions.timezone, disc: disciplines.code })
    .from(competitionScheduleChanges)
    .innerJoin(competitions, eq(competitionScheduleChanges.competitionId, competitions.id))
    .leftJoin(disciplines, eq(competitionScheduleChanges.disciplineId, disciplines.id))
    .where(isNull(competitionScheduleChanges.acknowledgedAt))
    .orderBy(desc(competitionScheduleChanges.detectedAt));

  const byComp = new Map<number, typeof rows>();
  for (const r of rows) byComp.set(r.c.competitionId, [...(byComp.get(r.c.competitionId) ?? []), r]);

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Izmene satnice</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          ISSF je promenio satnicu koju smo već imali; nova verzija je upisana. Vremena su po zoni takmičenja.
        </p>
      </div>
      <SyncNowButton />
      {byComp.size === 0 && <p className="text-sm text-[var(--muted)]">Nema neproverenih izmena.</p>}
      <div className="space-y-6">
        {[...byComp.entries()].map(([compId, list]) => (
          <section key={compId} className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="font-semibold text-[var(--ink)]">{list[0].name}</h2>
              <AckButton competitionId={compId} />
            </div>
            <ul className="space-y-1.5 text-sm">
              {list.map(({ c, tz, disc, location }) => (
                <li key={c.id} className="flex flex-wrap gap-x-3">
                  <span className="w-44 font-medium">{KIND[c.kind] ?? c.kind}</span>
                  {c.kind === "tz_missing" ? (
                    <TimezoneForm competitionId={compId} location={location} />
                  ) : (
                    <>
                      <span className="w-14">{disc}</span>
                      <span className="w-28 text-[var(--muted)]">{c.stage}{c.category === "junior" ? " · junior" : ""}</span>
                      <span>
                        {c.kind !== "added" && <span className={c.kind === "changed" ? "line-through text-[var(--muted)]" : ""}>{range(c.beforeStart, c.beforeEnd, tz)}</span>}
                        {c.kind === "changed" && " → "}
                        {c.kind !== "removed" && range(c.afterStart, c.afterEnd, tz)}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
