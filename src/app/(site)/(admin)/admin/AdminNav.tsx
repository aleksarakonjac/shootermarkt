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

const GROUPS: NavGroup[] = [
  {
    label: "Strelci",
    items: [
      { href: "/admin/strelci",      label: "Svi strelci" },
      { href: "/admin/strelci/novi", label: "Novi strelac" },
      { href: "/admin/strelci/issf", label: "ISSF bulk" },
    ],
  },
  {
    label: "Takmičenja",
    items: [
      { href: "/admin/takmicenja",       label: "Sva takmičenja" },
      { href: "/admin/takmicenja/novi",  label: "Novo takmičenje" },
      { href: "/admin/takmicenja/sync",  label: "Sync" },
    ],
  },
  {
    label: "Rezultati",
    items: [
      { href: "/admin/rezultati", label: "Unos rezultata" },
    ],
  },
  {
    label: "Ticker",
    items: [
      { href: "/admin/ticker",          label: "Ticker upravljanje" },
      { href: "/admin/issf/schedule",   label: "ISSF satnica" },
    ],
  },
];

export function AdminNav({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="Admin navigacija" className="flex-1 overflow-y-auto py-2 px-2">
      {/* Dashboard link */}
      <Link
        href="/admin"
        onClick={onNavClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors duration-100 ${
          isActive("/admin") && pathname === "/admin"
            ? "bg-[var(--surface-2)] text-[var(--brand-primary)]"
            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        Pregled
      </Link>

      {/* Groups */}
      {GROUPS.map((group) => (
        <div key={group.label} className="mt-4 first:mt-2">
          <p className="px-3 mb-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--subtle)] select-none">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-100 ${
                    active
                      ? "bg-[var(--surface-2)] text-[var(--brand-primary)] font-medium"
                      : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  }`}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[var(--brand-primary)]"
                      aria-hidden="true"
                    />
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
