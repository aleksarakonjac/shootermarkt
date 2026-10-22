"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped by workflow. "Novo …" actions live as buttons on their list pages, not in the nav.
const GROUPS: NavGroup[] = [
  {
    label: "Takmičenja",
    items: [
      { href: "/admin/takmicenja",      label: "Kalendar" },
      { href: "/admin/takmicenja/sync", label: "Uvoz iz kalendara" },
      { href: "/admin/issf/schedule",   label: "Satnica" },
      { href: "/admin/issf/schedule/changes", label: "Izmene satnice" },
    ],
  },
  {
    label: "Rezultati",
    items: [
      { href: "/admin/rezultati",        label: "Uvoz rezultata" },
      { href: "/admin/rezultati/period", label: "Uvoz za period" },
    ],
  },
  {
    label: "Strelci",
    items: [
      { href: "/admin/strelci",      label: "Svi strelci" },
      { href: "/admin/strelci/issf", label: "ISSF uvoz i osvežavanje" },
    ],
  },
  {
    label: "Sajt",
    items: [
      { href: "/admin/ticker", label: "Ticker" },
    ],
  },
];

const ALL_HREFS = ["/admin", ...GROUPS.flatMap((g) => g.items.map((i) => i.href))];

/** The longest nav href the path falls under — so /admin/takmicenja/sync doesn't also light up "Kalendar". */
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS
    .filter((href) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

const itemCls = (active: boolean) =>
  `relative flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150 ${
    active
      ? "bg-[var(--surface-2)] font-medium text-[var(--brand-primary)]"
      : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
  }`;

export function AdminNav() {
  const current = activeHref(usePathname());

  return (
    <nav aria-label="Admin navigacija" className="flex-1 overflow-y-auto px-2 py-2">
      <Link href="/admin" aria-current={current === "/admin" ? "page" : undefined} className={itemCls(current === "/admin")}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Pregled
      </Link>

      {GROUPS.map((group) => (
        <div key={group.label} className="mt-5">
          <p className="mb-1 select-none px-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--subtle)]">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = current === item.href;
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={itemCls(active)}>
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--brand-primary)]" aria-hidden="true" />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
