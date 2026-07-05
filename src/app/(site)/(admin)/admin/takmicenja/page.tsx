import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { desc, ilike, and, sql, eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { TakmicenjaFilters } from "./takmicenja-filters";
import { Pagination } from "../components/Pagination";

export const metadata: Metadata = { title: "Admin · Takmičenja" };

const PAGE_SIZE = 30;

const LEVEL_LABEL: Record<string, string> = {
  club: "Klubsko",
  regional: "Regionalno",
  national: "Državno",
  continental: "Kontinentalno",
  world: "Svetsko",
  olympic: "Olimpijsko",
};

export default async function AdminTakmicenjaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const q = sp.q?.trim() ?? "";
  const year = sp.year?.trim() ?? "";
  const level = sp.level?.trim() ?? "";

  const tag = sp.tag?.trim() ?? "";

  const conditions = [
    q ? ilike(competitions.name, `%${q}%`) : undefined,
    year ? sql`date_part('year', ${competitions.date}::date) = ${parseInt(year)}` : undefined,
    level ? eq(competitions.level, level as "club" | "regional" | "national" | "continental" | "world" | "olympic") : undefined,
    tag ? sql`${competitions.tags} @> ARRAY[${tag}]::varchar[]` : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, [{ total }], yearRows] = await Promise.all([
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        date: competitions.date,
        location: competitions.location,
        level: competitions.level,
        tags: competitions.tags,
        issfId: competitions.issfId,
        organizer: competitions.organizer,
      })
      .from(competitions)
      .where(where)
      .orderBy(desc(competitions.date))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(competitions)
      .where(where),
    db
      .select({ year: sql<number>`date_part('year', date::date)::int` })
      .from(competitions)
      .groupBy(sql`date_part('year', date::date)`)
      .orderBy(desc(sql`date_part('year', date::date)`)),
  ]);

  const years = yearRows.map((r) => r.year).filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Takmičenja
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">prikazano {data.length} od {total}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/takmicenja/sync"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Sync →
          </Link>
          <Link
            href="/admin/takmicenja/novi"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            + Dodaj
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <TakmicenjaFilters years={years} currentLevel={level} currentTag={tag} />
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {data.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">
            Nema takmičenja.{" "}
            <Link href="/admin/takmicenja/novi" className="text-[var(--brand-primary)] hover:underline">
              Dodaj prvo →
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Naziv</th>
                  <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Datum</th>
                  <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Lokacija</th>
                  <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Nivo</th>
                  <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Tagovi</th>
                  <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Izvor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--surface)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--ink)] max-w-xs truncate">{c.name}</td>
                    <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                      {c.date}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {c.location ?? <span className="text-[var(--subtle)]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                        {LEVEL_LABEL[c.level] ?? c.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).length > 0
                          ? (c.tags ?? []).map((t) => (
                              <span key={t} className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted)]">
                                {t.toUpperCase()}
                              </span>
                            ))
                          : <span className="text-[var(--subtle)] text-xs">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)]">
                      {c.organizer ?? c.issfId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/takmicenja/${c.id}/edit`}
                        className="text-xs font-medium text-[var(--muted)] hover:text-[var(--brand-primary)] transition-colors"
                      >
                        Uredi →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} />
          </>
        )}
      </div>
    </div>
  );
}
