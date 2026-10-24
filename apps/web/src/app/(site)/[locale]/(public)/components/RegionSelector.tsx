"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { DEFAULT_SCOPE, VALID_SCOPES, type Scope } from "@/lib/scope";
import { withScope } from "@/hooks/use-scoped-href";
import { setPrefCookie } from "@/lib/client-prefs";
import { startNavigationProgress } from "@/components/NavigationProgress";

// ── Helpers ────────────────────────────────────────────────────────────────────

function scopeIcon(scope: Scope): React.ReactNode {
  if (scope === "issf")
    return <Image src="/logos/issf.svg" alt="" aria-hidden={true} width={0} height={0} className="h-4 w-auto max-w-[2rem] object-contain" />;
  return <span className="fi fi-rs" style={{ fontSize: 15, borderRadius: 2 }} aria-hidden="true" />;
}

// ISSF prvi u dropdownu (VALID_SCOPES redosled ne diramo — koristi se za rute)
const MENU_ORDER: readonly Scope[] = ["issf", "srb"];

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  compact?: boolean;
  placement?: "bottom" | "top";
  /** Niži trigger za mobilni header */
  small?: boolean;
}

export function RegionSelector({ compact = false, placement = "bottom", small = false }: Props) {
  const t = useTranslations("common");
  const srbName = t("serbia");
  const scopeLabel = (s: Scope) => (s === "issf" ? "ISSF" : srbName);
  const menuLabel = (s: Scope) => (s === "issf" ? `ISSF / ${t("world")}` : srbName);
  const [open, setOpen]   = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const rawScope = params.scope as string | undefined;
  const scope = VALID_SCOPES.includes(rawScope as Scope) ? rawScope as Scope : DEFAULT_SCOPE;
  const locale = params.locale as string | undefined;

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function scopeUrl(s: Scope) {
    const query = window.location.search.slice(1);
    return withScope(s, `${pathname}${query ? `?${query}` : ""}`);
  }

  function select(nextScope: Scope) {
    setOpen(false);
    setPrefCookie("pref_scope", nextScope);
    if (nextScope !== scope) startNavigationProgress();
    router.push(scopeUrl(nextScope), locale ? { locale } : undefined);
  }

  function handleTriggerClick() {
    // Prefetch the other scope so navigation feels instant after dropdown opens
    if (!open) {
      const other: Scope = scope === "srb" ? "issf" : "srb";
      router.prefetch(scopeUrl(other));
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Trigger */}
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Opseg: ${scopeLabel(scope)}`}
        className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] ${
          small ? "h-8 py-0" : "min-h-11 py-1.5 lg:min-h-8"
        } ${
          open ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]" : ""
        }`}
      >
        {scopeIcon(scope)}
        {!compact && <span>{scopeLabel(scope)}</span>}
        <svg
          width="9" height="9" viewBox="0 0 9 9"
          className={`shrink-0 text-[var(--muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </button>

      {/* Panel */}
      <div
        className={`absolute right-0 z-[var(--z-dropdown)] w-[11rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]
          transition-[opacity,transform,visibility] duration-150 ease-out
          ${placement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}
          ${open
            ? "opacity-100 translate-y-0 visible pointer-events-auto"
            : `opacity-0 ${placement === "top" ? "translate-y-2" : "-translate-y-2"} invisible pointer-events-none`
          }`}
      >
        {/* Ravnopravni izbori — hijerarhija kad bude više scope-ova */}
        {MENU_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => select(s)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
              scope === s
                ? "bg-[var(--surface)] text-[var(--brand-primary)]"
                : "text-[var(--ink)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <span className="flex w-8 shrink-0 justify-center">{scopeIcon(s)}</span>
            <span className="flex-1 text-xs font-medium">{menuLabel(s)}</span>
            {scope === s && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--brand-primary)]" aria-hidden="true">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
