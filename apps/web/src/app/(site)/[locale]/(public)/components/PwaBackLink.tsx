"use client";

import { ChevronLeft } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";

/**
 * "Nazad" za instaliranu PWA (standalone) — tamo nema browserskog back dugmeta.
 * U običnom browseru (i na desktopu) je skriveno. Nema ga na početnoj strani.
 */
export function PwaBackLink({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const scope = typeof params?.scope === "string" ? params.scope : "srb";
  const locale = typeof params?.locale === "string" ? params.locale : "sr";
  const isHome = /^\/(?:(?:sr|en)\/)?(?:srb|issf)\/?$/.test(pathname) || pathname === "/";
  if (isHome) return null;

  function goBack() {
    // Bez istorije (ulaz preko linka) back bi izbacio iz aplikacije — vodi na početnu scope-a.
    if (window.history.length > 1) router.back();
    else router.push(`/${locale}/${scope}`);
  }

  return (
    <div className="hidden px-4 pt-3 sm:px-6 lg:!hidden [@media(display-mode:standalone)]:block">
      <button
        type="button"
        onClick={goBack}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        <ChevronLeft size={18} aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}
