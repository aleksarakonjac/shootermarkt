"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ScopedLink } from "../components/ScopedLink";
import { LocaleSwitcher } from "../components/LocaleSwitcher";

const SEEN_KEY = "sm_intro_seen";

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: never nag on every visit
  }
}

const noopSubscribe = () => () => {};

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {}
}

const LINKS = [
  { href: "/takmicenja", key: "competitions" },
  { href: "/strelci", key: "shooters" },
  { href: "/rangiranje", key: "ranking" },
] as const;

// First-visit intro (e.g. people arriving from the printed flyer QR code),
// pinned above the homepage's "In focus" block. Shown until the visitor closes
// it or follows one of its links. Switching language keeps it open.
export function FirstVisitIntro() {
  const t = useTranslations("intro");
  // Server render and hydration treat it as seen; the client then reads storage.
  const seen = useSyncExternalStore(noopSubscribe, readSeen, () => true);
  const [closed, setClosed] = useState(false);

  if (seen || closed) return null;

  function close() {
    markSeen();
    setClosed(true);
  }

  return (
    <section
      aria-labelledby="first-visit-intro-title"
      className="first-visit-intro mb-6 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 pt-2.5 pb-4 text-[var(--ink)] sm:px-6 sm:pt-3.5 sm:pb-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.95rem] font-semibold text-[var(--brand-primary)]">{t("eyebrow")}</p>
        <div className="-my-1 flex items-center gap-1">
          <LocaleSwitcher />
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="-mr-2 flex size-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <h2
          id="first-visit-intro-title"
          className="text-[1.5rem] leading-[1.05] font-extrabold uppercase font-[family-name:var(--font-display)] text-balance sm:text-[1.75rem]"
        >
          {t("title")}
        </h2>

        {/* -my-3 cancels the 44px hit area so the visible text sits on the panel's padding */}
        <ul className="-my-3 flex flex-wrap gap-x-4 sm:gap-x-5 lg:shrink-0">
          {LINKS.map(({ href, key }) => (
            <li key={key}>
              <ScopedLink
                href={href}
                onClick={markSeen}
                title={t(`links.${key}.desc`)}
                className="group flex min-h-11 items-center gap-1 text-sm font-semibold hover:text-[var(--brand-primary)] sm:text-[0.95rem]"
              >
                {t(`links.${key}.label`)}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--brand-primary)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </ScopedLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
