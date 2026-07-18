"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import ThemeToggle from "./ThemeToggle";
import { RegionSelector } from "./RegionSelector";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useScopedHref } from "@/hooks/use-scoped-href";

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
        { href: "/rangiranje?view=h2h", label: t("h2h"),   desc: t("h2hDesc") },
        { href: "/klubovi",    label: t("clubLeaderboard"),desc: t("clubLeaderboardDesc"), soon: true },
        { href: "/forma",      label: t("trendAnalysis"),  desc: t("trendAnalysisDesc"),   soon: true },
      ],
    },
    {
      key: "takmicenja",
      label: t("competitions"),
      items: [
        { href: "/takmicenja", label: t("competitionList"),desc: t("competitionListDesc") },
        { href: "/takmicenja?view=cal", label: t("calendar"), desc: t("calendarDesc") },
      ],
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

function SoonBadge({ label }: { label: string }) {
  return (
    <span className="ml-auto shrink-0 text-[0.55rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--subtle)] border border-[var(--border)]">
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
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

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
      <div ref={desktopNavRef} className="hidden lg:flex items-center gap-0.5">
        {NAV.map((group) => {
          const active = isGroupActive(group);
          const open = openKey === group.key;

          if (group.directHref) {
            const active = unscopedPathname.startsWith(group.directHref);
            return (
              <Link
                key={group.key}
                href={scopedHref(group.directHref)}
                className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {group.label}
                {active && (
                  <span className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-[var(--brand-primary)] rounded-full" />
                )}
              </Link>
            );
          }

          return (
            <div
              key={group.key}
              className="relative"
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
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {group.label}
                {/* Active underline */}
                {active && !open && (
                  <span className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-[var(--brand-primary)] rounded-full" />
                )}
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
                        <span className={`text-sm font-semibold leading-snug ${item.soon ? "text-[var(--muted)]" : itemActive ? "text-[var(--brand-primary)]" : "text-[var(--ink)]"}`}>
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
        className={`fixed inset-0 top-14 z-[var(--z-modal-bd)] bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        id="mobile-navigation"
        className={`fixed top-14 right-0 bottom-0 w-[17.5rem] max-w-[90vw] z-[var(--z-modal)] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col
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
            <span className="flex-1 text-left text-sm">{tSearch("drawerPlaceholder")}</span>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label={tCommon("mobileNav")}>
          {NAV.map((group) => {
            if (group.directHref) {
              const active = unscopedPathname.startsWith(group.directHref);
              return (
                <Link
                  key={group.key}
                  href={scopedHref(group.directHref)}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 text-sm font-semibold transition-colors hover:bg-[var(--surface-2)] ${
                    active ? "text-[var(--brand-primary)]" : "text-[var(--ink)]"
                  }`}
                >
                  {group.label}
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
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                    active ? "text-[var(--brand-primary)]" : "text-[var(--ink)]"
                  } hover:bg-[var(--surface-2)]`}
                  aria-expanded={isExpanded}
                >
                  {group.label}
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
                            <p className={`text-sm font-medium leading-snug ${item.soon ? "text-[var(--muted)]" : itemActive ? "text-[var(--brand-primary)]" : "text-[var(--ink)]"}`}>
                              {item.label}
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
          <RegionSelector placement="top" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}
