"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";

export default function HeaderHomeLink() {
  const pathname = usePathname();
  const isHome = pathname === "/" || pathname === "";
  return (
    <Link
      href="/"
      className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 select-none ${
        isHome
          ? "text-[var(--brand-primary)]"
          : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
      }`}
    >
      Home
      {isHome && (
        <span className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-[var(--brand-primary)] rounded-full" />
      )}
    </Link>
  );
}
