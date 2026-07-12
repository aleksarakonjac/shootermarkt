"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchShooter = {
  id: number;
  firstName: string;
  lastName: string;
  clubName: string | null;
  avatarUrl: string | null;
};

export type SearchCompetition = {
  id: number;
  name: string;
  date: string;
  level: string;
};

interface Props {
  shooters: SearchShooter[];
  competitions: SearchCompetition[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ShooterAvatar({
  firstName,
  lastName,
  avatarUrl,
}: {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}) {
  const initials = `${lastName[0] ?? ""}${firstName[0] ?? ""}`.toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={32}
        height={32}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <span
      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[0.65rem] font-bold text-white select-none"
      style={{ background: "var(--brand-primary)" }}
    >
      {initials}
    </span>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="7"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M11 11L14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--subtle)]"
    >
      <path
        d="M2.5 6h7M7 3.5L9.5 6L7 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GlobalSearch({ shooters, competitions }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("search");

  useEffect(() => setMounted(true), []);

  const openModal = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const closeModal = useCallback(() => setIsOpen(false), []);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => {
          if (!v) { setQuery(""); setActiveIndex(0); }
          return !v;
        });
      }
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onGlobalKey);
    return () => document.removeEventListener("keydown", onGlobalKey);
  }, [closeModal]);

  // External trigger (mobile drawer, etc.)
  useEffect(() => {
    function handler() { openModal(); }
    document.addEventListener("global-search:open", handler);
    return () => document.removeEventListener("global-search:open", handler);
  }, [openModal]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Filter
  const q = query.toLowerCase().trim();

  const filteredShooters = q
    ? shooters
        .filter((s) =>
          `${s.firstName} ${s.lastName} ${s.lastName} ${s.firstName} ${s.clubName ?? ""}`.toLowerCase().includes(q)
        )
        .slice(0, 5)
    : [];

  const filteredComps = q
    ? competitions
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 5)
    : [];

  const total = filteredShooters.length + filteredComps.length;

  // Keyboard nav within modal
  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((v) => Math.min(v + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (total === 0) return;
      if (activeIndex < filteredShooters.length) {
        router.push(`/strelci/${filteredShooters[activeIndex].id}`);
      } else {
        const c = filteredComps[activeIndex - filteredShooters.length];
        if (c) router.push(`/takmicenja/${c.id}`);
      }
      closeModal();
    }
  }

  useEffect(() => setActiveIndex(0), [query]);

  // ── Modal JSX ─────────────────────────────────────────────────────────────

  const modal = (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center px-4"
      style={{ paddingTop: "12vh", background: "oklch(0 0 0 / 0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--border)] overflow-hidden"
        style={{
          background: "var(--bg)",
          boxShadow: "0 24px 80px oklch(0 0 0 / 0.2), 0 4px 16px oklch(0 0 0 / 0.1)",
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--border)]">
          <span className="shrink-0 text-[var(--muted)]">
            <SearchIcon size={15} />
          </span>
          <input
            ref={inputRef}
            type="search"
            name="q"
            placeholder={t("fullPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="flex-1 py-[1.1rem] text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] bg-transparent outline-none focus:outline-none focus:ring-0 [&:focus-visible]:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="shrink-0 text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors px-1 py-0.5"
            >
              {t("clear")}
            </button>
          )}
          <kbd
            onClick={closeModal}
            className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] px-1.5 py-1 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--subtle)] cursor-pointer hover:text-[var(--muted)] transition-colors select-none"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: "min(58vh, 420px)" }}>
          {!q ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--subtle)]">
                {t("emptyHint")}
              </p>
            </div>
          ) : total === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">
                {t("noResults", { query })}
              </p>
            </div>
          ) : (
            <>
              {/* Shooters section */}
              {filteredShooters.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--subtle)]">
                      {t("shootersSection")}
                    </span>
                  </div>
                  {filteredShooters.map((s, i) => {
                    const active = activeIndex === i;
                    return (
                      <Link
                        key={s.id}
                        href={`/strelci/${s.id}`}
                        onClick={closeModal}
                        onMouseEnter={() => setActiveIndex(i)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                        style={{ background: active ? "var(--surface-2)" : "transparent" }}
                      >
                        <ShooterAvatar
                          firstName={s.firstName}
                          lastName={s.lastName}
                          avatarUrl={s.avatarUrl}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--ink)] truncate">
                            {s.lastName} {s.firstName}
                          </p>
                          {s.clubName && (
                            <p className="text-xs text-[var(--muted)] truncate">
                              {s.clubName}
                            </p>
                          )}
                        </div>
                        {active && <ArrowIcon />}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Competitions section */}
              {filteredComps.length > 0 && (
                <div
                  className={filteredShooters.length > 0 ? "border-t border-[var(--border)]" : ""}
                >
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--subtle)]">
                      {t("competitionsSection")}
                    </span>
                  </div>
                  {filteredComps.map((c, i) => {
                    const globalIdx = filteredShooters.length + i;
                    const active = activeIndex === globalIdx;
                    const levelStyle = LEVEL_STYLE[c.level] ?? {
                      background: "#f3f4f6",
                      color: "#4b5563",
                    };
                    const levelLabel = LEVEL_LABEL[c.level] ?? c.level;

                    return (
                      <Link
                        key={c.id}
                        href={`/takmicenja/${c.id}`}
                        onClick={closeModal}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                        style={{ background: active ? "var(--surface-2)" : "transparent" }}
                      >
                        {/* Calendar icon tile */}
                        <span
                          className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                          style={{ background: "var(--surface-2)" }}
                          aria-hidden="true"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            className="text-[var(--muted)]"
                          >
                            <rect
                              x="1"
                              y="2"
                              width="12"
                              height="11"
                              rx="1.5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                            />
                            <path
                              d="M1 6h12M4.5 1v2M9.5 1v2"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--ink)] truncate">
                            {c.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[0.6rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded font-[family-name:var(--font-barlow-condensed)]"
                              style={levelStyle}
                            >
                              {levelLabel}
                            </span>
                            <span className="text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
                              {c.date}
                            </span>
                          </div>
                        </div>
                        {active && <ArrowIcon />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hints */}
        {total > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-2 flex items-center gap-4 text-[0.6rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] select-none">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)]">↑↓</kbd>
              {t("navArrows")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)]">↵</kbd>
              {t("navEnter")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)]">esc</kbd>
              {t("navEsc")}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop trigger — pill with ⌘K hint */}
      <button
        onClick={openModal}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)] transition-all w-44 lg:w-52 cursor-pointer"
      >
        <span className="text-[var(--subtle)] shrink-0">
          <SearchIcon size={13} />
        </span>
        <span className="flex-1 text-left">{t("desktopPlaceholder")}</span>
        <kbd className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--subtle)] shrink-0 select-none">
          ⌘K
        </kbd>
      </button>

      {/* Mobile trigger — icon only */}
      <button
        onClick={openModal}
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
        aria-label={t("ariaLabel")}
      >
        <SearchIcon size={16} />
      </button>

      {/* Portal modal — renders in body, outside header stacking context */}
      {mounted && isOpen && createPortal(modal, document.body)}
    </>
  );
}
