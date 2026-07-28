"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useScopedHref } from "@/hooks/use-scoped-href";

const links = [
  { href: "/strelci", label: "Strelci" },
  { href: "/rangiranje", label: "Rangiranje" },
  { href: "/takmicenja", label: "Takmičenja" },
];

export function NavLinks() {
  const pathname = usePathname();
  const scopedHref = useScopedHref();
  const unscopedPathname = pathname.replace(/^\/(?:srb|issf)(?=\/|$)/, "") || "/";

  return (
    <nav className="hidden sm:flex items-center gap-1 flex-1">
      {links.map(({ href, label }) => {
        const active = unscopedPathname.startsWith(href);
        return (
          <Link
            key={href}
            href={scopedHref(href)}
            className={`relative px-3 py-1.5 text-sm font-medium transition-colors duration-150 rounded-md ${
              active
                ? "text-[var(--brand-primary)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
            {active && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--brand-primary)] rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
