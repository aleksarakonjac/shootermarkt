import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { desc, asc, ilike, and, sql, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { Pagination } from "../components/Pagination";
import { TakmicenjaFilters } from "./takmicenja-filters";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";

export const metadata: Metadata = { title: "Admin · Takmičenja" };

const PAGE_SIZE = 30;

export default async function AdminTakmicenjaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const q = sp.q?.trim() ?? "";
  const currentYear = new Date().getFullYear().toString();
  const year = sp.year?.trim() ?? currentYear;
  const level = sp.level?.trim() ?? "";
  const tag = sp.tag?.trim() ?? "";

  const today = new Date().toISOString().split("T")[0];

  const conditions = [
    q ? ilike(competitions.name, `%${q}%`) : undefined,
    year ? sql`date_part('year', ${competitions.date}::date) = ${parseInt(year)}` : undefined,
    level ? eq(competitions.level, level as "club" | "regional" | "national" | "continental" | "world" | "olympic") : undefined,
    tag ? sql`${competitions.tags} @> ARRAY[${tag}]::varchar[]` : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const baseWhere = conditions.length ? and(...conditions) : undefined;

  const upcomingCondition = baseWhere
    ? and(baseWhere, gte(competitions.date, today))
    : gte(competitions.date, today);

  const pastCondition = baseWhere
    ? and(baseWhere, lt(competitions.date, today))
    : lt(competitions.date, today);

  const [upcomingCountRes, pastCountRes] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(competitions).where(upcomingCondition),
    db.select({ total: sql<number>`count(*)::int` }).from(competitions).where(pastCondition),
  ]);

  const upcomingCount = upcomingCountRes[0]?.total ?? 0;
  const pastCount = pastCountRes[0]?.total ?? 0;

  let status = sp.status?.trim();
  if (status !== "upcoming" && status !== "past") {
    status = upcomingCount > 0 ? "upcoming" : "past";
  }

  const activeWhere = status === "upcoming" ? upcomingCondition : pastCondition;
  const total = status === "upcoming" ? upcomingCount : pastCount;

  const defaultOrder = status === "upcoming" ? "asc" : "desc";
  const sort = sp.sort?.trim() || "date";
  const order = sp.order?.trim() || defaultOrder;

  const sortColumnMap = {
    name: competitions.name,
    date: competitions.date,
    location: competitions.location,
    level: competitions.level,
  };

  const sortColumn = sortColumnMap[sort as keyof typeof sortColumnMap] ?? competitions.date;
  const orderByExpr = order === "asc"
    ? [asc(sortColumn), desc(competitions.id)]
    : [desc(sortColumn), desc(competitions.id)];

  const getSortHref = (col: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (year) params.set("year", year);
    if (level) params.set("level", level);
    if (tag) params.set("tag", tag);
    params.set("status", status);

    params.set("sort", col);
    if (sort === col && order === "asc") {
      params.set("order", "desc");
    } else {
      params.set("order", "asc");
    }
    params.set("page", "1");
    return `/admin/takmicenja?${params.toString()}`;
  };

  const getStatusTabHref = (targetStatus: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (year) params.set("year", year);
    if (level) params.set("level", level);
    if (tag) params.set("tag", tag);

    params.set("status", targetStatus);
    params.set("page", "1");
    return `/admin/takmicenja?${params.toString()}`;
  };

  const renderSortableHeader = (col: string, label: string) => {
    const isActive = sort === col;
    const isAsc = order === "asc";
    return (
      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] select-none">
        <Link
          href={getSortHref(col)}
          className="group inline-flex items-center gap-1 hover:text-[var(--ink)] transition-colors"
        >
          {label}
          <span className={`inline-flex items-center transition-colors ${
            isActive ? "text-[var(--brand-primary)] opacity-100" : "text-[var(--subtle)] opacity-0 group-hover:opacity-100"
          }`}>
            {isActive ? (isAsc ? "↑" : "↓") : "↕"}
          </span>
        </Link>
      </th>
    );
  };

  const [data, yearRows] = await Promise.all([
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        date: competitions.date,
        dateEnd: competitions.dateEnd,
        location: competitions.location,
        level: competitions.level,
        issfId: competitions.issfId,
        organizer: competitions.organizer,
      })
      .from(competitions)
      .where(activeWhere)
      .orderBy(...orderByExpr)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ year: sql<number>`date_part('year', ${competitions.date}::date)::int` })
      .from(competitions)
      .groupBy(sql`date_part('year', ${competitions.date}::date)`)
      .orderBy(desc(sql`date_part('year', ${competitions.date}::date)`)),
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

      <div className="flex border-b border-[var(--border)] mb-6">
        <Link
          href={getStatusTabHref("upcoming")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            status === "upcoming"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          Nadolazeća ({upcomingCount})
        </Link>
        <Link
          href={getStatusTabHref("past")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            status === "past"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          Prošla ({pastCount})
        </Link>
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
                  {renderSortableHeader("name", "Naziv")}
                  {renderSortableHeader("date", "Datum")}
                  {renderSortableHeader("location", "Lokacija")}
                  {renderSortableHeader("level", "Nivo")}
                  <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Izvor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--surface)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--ink)] max-w-xs truncate">{c.name}</td>
                    <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                      {c.date}{c.dateEnd && c.dateEnd !== c.date ? ` – ${c.dateEnd}` : ""}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {c.location ?? <span className="text-[var(--subtle)]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded" style={LEVEL_STYLE[c.level] ?? { background: "#f3f4f6", color: "#4b5563" }}>
                        {LEVEL_LABEL[c.level] ?? c.level}
                      </span>
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
