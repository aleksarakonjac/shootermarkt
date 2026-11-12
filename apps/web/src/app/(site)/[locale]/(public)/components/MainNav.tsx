"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import ThemeToggle from "./ThemeToggle";
import { RegionSelector } from "./RegionSelector";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { OlympicRings } from "@/components/result-display/OlympicQuotaBadge";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NavSubItem {
  href: string;
  label: string;
  desc: string;
  soon?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  directHref?: string;
  /** Izdvojena stavka: olimpijski krugovi i okvir (samo Olimpijske kvote). */
  featured?: boolean;
  items: NavSubItem[];
}

// ── Nav config ─────────────────────────────────────────────────────────────────

type TFn = (key: string) => string;

function buildNav(t: TFn): NavGroup[] {
  return [
    {
      key: "strelci",
      label: t("shooters"),
      directHref: "/strelci",
      items: [],
    },
    {
      key: "statistike",
      label: t("statistics"),
      items: [
        { href: "/rangiranje", label: t("ranking"),        desc: t("rankingDesc") },
        { href: "/head-to-head", label: t("h2h"),   desc: t("h2hDesc") },
      ],
    },
    {
      key: "takmicenja",
      label: t("competitionList"),
      directHref: "/takmicenja",
      items: [],
    },
    {
      key: "olimpijske-igre",
      label: t("olympicQuotas"),
      directHref: "/olimpijske-igre",
      featured: true,
      items: [],
    },
    {
      key: "vesti",
      label: t("news"),
      directHref: "/vesti",
      items: [],
    },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Olimpijski krugovi; na crvenoj (izabranoj) kutiji sede na beloj podlozi (crni prsten prati --ink, pa ga fiksiramo da bude vidljiv i u tamnoj temi). Padding je isti u oba stanja da kutija ne skače. */
function FeaturedRings({ height, padY = "py-1", onRed = false }: { height: number; padY?: string; onRed?: boolean }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 rounded px-1.5 ${padY} ${onRed ? "bg-white" : ""}`} style={onRed ? ({ "--ink": "#111111" } as React.CSSProperties) : undefined}>
      <OlympicRings height={height} />
    </span>
  );
}

/** Otvorena stavka u mobilnom meniju: crvena crta ispod teksta (na crvenoj kutiji bela). */
const ACTIVE_LABEL = (active: boolean, onRed = false) =>
  active ? `underline decoration-2 underline-offset-[6px] ${onRed ? "decoration-white" : "decoration-[var(--brand-primary)]"}` : "";

function SoonBadge({ label }: { label: string }) {
  return (
    <span className="ml-auto shrink-0 text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--subtle)] border border-[var(--border)]">
      {label}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MainNav() {
  const pathname = usePathname();
  const scopedHref = useScopedHref();
  const unscopedPathname = pathname.replace(/^\/(?:srb|issf)(?=\/|$)/, "") || "/";
  const tNav = useTranslations("nav");
  const NAV = buildNav(tNav);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Statistike otvorene po defaultu — meni je kratak
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>("statistike");
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  // Jedna crvena crta klizi ispod otvorene stavke (desktop). Pozicija se meri iz DOM-a, bez animacije pri prvom prikazu.
  const [indicator, setIndicator] = useState<{ left: number; width: number; visible: boolean } | null>(null);
  const [indicatorAnimated, setIndicatorAnimated] = useState(false);
  useLayoutEffect(() => {
    const nav = desktopNavRef.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>("[data-nav-active]");
      if (!el) {
        setIndicator((prev) => (prev ? { ...prev, visible: false } : prev));
        return;
      }
      const inset = 12;
      setIndicator({ left: el.offsetLeft + inset, width: Math.max(el.offsetWidth - inset * 2, 0), visible: true });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    Array.from(nav.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
  }, [unscopedPathname]);
  useEffect(() => {
    if (indicator === null || indicatorAnimated) return;
    const id = requestAnimationFrame(() => setIndicatorAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [indicator, indicatorAnimated]);

  const tSearch = useTranslations("search");
  const tCommon = useTranslations("common");

  function openGlobalSearch() {
    setMobileOpen(false);
    setTimeout(
      () => document.dispatchEvent(new CustomEvent("global-search:open")),
      180
    );
  }

  // Close everything on route change
  useEffect(() => {
    void Promise.resolve().then(() => {
      setOpenKey(null);
      setMobileOpen(false);
    });
  }, [pathname]);

  // ESC closes dropdowns / drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenKey(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click outside desktop nav → close dropdown
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      lastFocusedElementRef.current?.focus();
      lastFocusedElementRef.current = null;
      return;
    }

    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusable?.[0]?.focus();

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !focusable?.length) return;
      const items = [...focusable];
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [mobileOpen]);

  function toggleDropdown(key: string) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  function hoverOpen(key: string) {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setOpenKey(key);
  }

  function hoverClose() {
    hoverTimeout.current = setTimeout(() => setOpenKey(null), 120);
  }

  function hoverKeepOpen() {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }

  function isGroupActive(group: NavGroup): boolean {
    return group.items.some((i) => !i.soon && unscopedPathname.startsWith(i.href));
  }

  return (
    <>
      {/* ── Desktop nav ──────────────────────────────────────────────── */}
      <div ref={desktopNavRef} className="relative hidden lg:flex items-center gap-0.5">
        <Link
          href={scopedHref("/")}
          data-nav-active={unscopedPathname === "/" ? "" : undefined}
          className={`relative rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
            unscopedPathname === "/" ? "text-[var(--ink)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          }`}
        >
          Home
        </Link>
        {NAV.map((group) => {
          const active = isGroupActive(group);
          const open = openKey === group.key;

          if (group.directHref) {
            const active = unscopedPathname.startsWith(group.directHref);
            return (
              <Link
                key={group.key}
                href={scopedHref(group.directHref)}
                data-nav-active={active && !group.featured ? "" : undefined}
                className={`relative whitespace-nowrap ${group.featured ? "rounded-lg" : "rounded-md"} text-sm font-medium transition-colors duration-150 ${
                  group.featured ? "mx-1 inline-flex items-center gap-2 py-[6.5px] pl-2.5 pr-3" : "px-3 py-2"
                } ${
                  group.featured
                    ? `font-semibold ring-2 ring-inset ring-[var(--brand-primary)] ${active ? "bg-[var(--brand-primary)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"}`
                    : active
                      ? "text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {group.featured && <FeaturedRings height={14} padY="py-[4.5px]" onRed={active} />}
                {group.label}
              </Link>
            );
          }

          return (
            <div
              key={group.key}
              className="relative"
              data-nav-active={active ? "" : undefined}
              onMouseEnter={() => hoverOpen(group.key)}
              onMouseLeave={hoverClose}
            >
              {/* Trigger */}
              <button
                onClick={() => toggleDropdown(group.key)}
                aria-expanded={open}
                className={`relative flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 select-none ${
                  open
                    ? "text-[var(--ink)] bg-[var(--surface-2)]"
                    : active
                    ? "text-[var(--ink)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {group.label}
                {/* Chevron */}
                <svg
                  width="10" height="10" viewBox="0 0 10 10"
                  className={`shrink-0 text-current transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>

              {/* Dropdown panel — always in DOM for transition */}
              <div
                onMouseEnter={hoverKeepOpen}
                onMouseLeave={hoverClose}
                className={`absolute top-[calc(100%+8px)] left-0 min-w-[240px] rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_32px_oklch(0_0_0/0.1)] z-[var(--z-dropdown)] overflow-hidden
                  transition-[opacity,transform,visibility] duration-150 ease-out
                  ${open
                    ? "opacity-100 translate-y-0 visible pointer-events-auto"
                    : "opacity-0 -translate-y-2 invisible pointer-events-none"
                  }`}
              >
                {group.items.map((item, idx) => {
                  const itemActive = !item.soon && unscopedPathname.startsWith(item.href);
                  const isLast = idx === group.items.length - 1;
                  const inner = (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold leading-snug ${item.soon ? "text-[var(--muted)]" : "text-[var(--ink)]"} ${ACTIVE_LABEL(itemActive)}`}>
                          {item.label}
                        </span>
                        {item.soon && <SoonBadge label={tNav("soon")} />}
                      </div>
                      <p className={`text-xs mt-0.5 leading-snug ${item.soon ? "text-[var(--subtle)]" : "text-[var(--muted)]"}`}>
                        {item.desc}
                      </p>
                    </>
                  );
                  return item.soon ? (
                    <div
                      key={item.href}
                      className={`px-3.5 py-3 cursor-default ${!isLast ? "border-b border-[var(--border)]" : ""}`}
                      aria-disabled="true"
                    >
                      {inner}
                    </div>
                  ) : (
                    <Link
                      key={item.href}
                      href={scopedHref(item.href)}
                      onClick={() => setOpenKey(null)}
                      className={`block px-3.5 py-3 transition-colors duration-100 ${!isLast ? "border-b border-[var(--border)]" : ""} ${
                        itemActive ? "bg-[var(--surface)]" : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Klizna crvena crta ispod otvorene stavke */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-[var(--brand-primary)] motion-reduce:transition-none ${
            indicatorAnimated ? "transition-[transform,width,opacity] duration-300 ease-[var(--ease-out)]" : ""
          }`}
          style={{ width: indicator?.width ?? 0, transform: `translateX(${indicator?.left ?? 0}px)`, opacity: indicator?.visible ? 1 : 0 }}
        />
      </div>

      {/* ── Mobile hamburger ─────────────────────────────────────────── */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? tCommon("closeMenu") : tCommon("openMenu")}
        aria-expanded={mobileOpen}
        ref={menuButtonRef}
        aria-controls="mobile-navigation"
        className="lg:hidden ml-auto flex flex-col items-center justify-center w-11 h-11 rounded-md hover:bg-[var(--surface-2)] transition-colors gap-[5px] shrink-0"
      >
        <span className={`block w-5 h-[1.5px] bg-[var(--ink)] rounded-full transition-all duration-200 origin-center ${mobileOpen ? "rotate-45 translate-y-[6.5px]" : ""}`} />
        <span className={`block w-5 h-[1.5px] bg-[var(--ink)] rounded-full transition-all duration-200 ${mobileOpen ? "opacity-0 scale-x-0" : ""}`} />
        <span className={`block w-5 h-[1.5px] bg-[var(--ink)] rounded-full transition-all duration-200 origin-center ${mobileOpen ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
      </button>

      {/* ── Mobile backdrop ───────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 top-[var(--site-header-h,3.5rem)] z-[var(--z-modal-bd)] bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        id="mobile-navigation"
        className={`fixed top-[var(--site-header-h,3.5rem)] right-0 bottom-0 w-[17.5rem] max-w-[90vw] z-[var(--z-modal)] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        inert={!mobileOpen}
        role={mobileOpen ? "dialog" : undefined}
        aria-label={tCommon("navigation")}
        aria-hidden={!mobileOpen}
        aria-modal={mobileOpen || undefined}
      >
        {/* Search trigger */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
          <button
            onClick={openGlobalSearch}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-[var(--subtle)]">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-sm">{tSearch("drawerPlaceholder")}</span>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label={tCommon("mobileNav")}>
          <Link
            href={scopedHref("/")}
            onClick={() => setMobileOpen(false)}
            className="block px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <span className={ACTIVE_LABEL(unscopedPathname === "/")}>Home</span>
          </Link>
          {NAV.map((group) => {
            if (group.directHref) {
              const active = unscopedPathname.startsWith(group.directHref);
              return (
                <Link
                  key={group.key}
                  href={scopedHref(group.directHref)}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm font-semibold transition-colors ${
                    group.featured
                      ? `ml-3 my-1.5 flex w-fit min-h-11 items-center gap-2.5 rounded-lg py-1 pl-2 pr-10 ring-2 ring-inset ring-[var(--brand-primary)] ${active ? "bg-[var(--brand-primary)] text-white" : "text-[var(--ink)] hover:bg-[var(--surface-2)]"}`
                      : "block px-4 py-3 text-[var(--ink)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {group.featured && <FeaturedRings height={15} padY="py-1.5" onRed={active} />}
                  <span className={group.featured ? "" : ACTIVE_LABEL(active)}>{group.label}</span>
                </Link>
              );
            }

            const isExpanded = openMobileGroup === group.key;
            const active = isGroupActive(group);

            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => setOpenMobileGroup(isExpanded ? null : group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-2)]"
                  aria-expanded={isExpanded}
                >
                  <span className={ACTIVE_LABEL(active)}>{group.label}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12"
                    className={`text-[var(--muted)] transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </button>

                {/* Sub items */}
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out  ${
                    isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    {group.items.map((item) => {
                      const itemActive = !item.soon && unscopedPathname.startsWith(item.href);
                      const inner = (
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div>
                            <p className={`text-sm font-medium leading-snug ${item.soon ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}>
                              <span className={ACTIVE_LABEL(itemActive)}>{item.label}</span>
                            </p>
                            <p className="text-xs text-[var(--subtle)] mt-0.5 leading-snug">
                              {item.desc}
                            </p>
                          </div>
                          {item.soon && <SoonBadge label={tNav("soon")} />}
                        </div>
                      );
                      return item.soon ? (
                        <div key={item.href} className="pl-6 pr-4 py-2.5 cursor-default opacity-70">
                          {inner}
                        </div>
                      ) : (
                        <Link
                          key={item.href}
                          href={scopedHref(item.href)}
                          className={`block pl-6 pr-4 py-2.5 transition-colors hover:bg-[var(--surface-2)] ${itemActive ? "bg-[var(--surface)]" : ""}`}
                          onClick={() => setMobileOpen(false)}
                        >
                          {inner}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-[var(--border)] px-4 py-3 flex items-center gap-2">
          <RegionSelector placement="top" small />
          <ThemeToggle />
          <div className="ml-auto">
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}
