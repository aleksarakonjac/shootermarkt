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
      className="first-visit-intro relative mb-6 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-4 pr-12 text-[var(--ink)] sm:p-6 sm:pr-14"
    >
      <button
        type="button"
        onClick={close}
        aria-label={t("close")}
        className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] sm:top-3 sm:right-3"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)] font-[family-name:var(--font-jetbrains-mono)]">
            {t("eyebrow")}
          </p>
          <h2
            id="first-visit-intro-title"
            className="mt-1 text-[1.5rem] leading-[1.05] font-extrabold uppercase font-[family-name:var(--font-display)] text-balance sm:text-[2rem]"
          >
            {t("title")}
          </h2>
          <p className="mt-2 hidden max-w-prose text-sm leading-relaxed text-[var(--muted)] sm:block">{t("body")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">{t("language")}</span>
            <LocaleSwitcher />
          </div>
        </div>

        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)] self-end">
          {LINKS.map(({ href, key }) => (
            <li key={key}>
              <ScopedLink
                href={href}
                onClick={markSeen}
                className="flex min-h-11 items-center justify-between gap-3 text-sm hover:text-[var(--brand-primary)]"
              >
                <span>
                  <span className="font-semibold">{t(`links.${key}.label`)}</span>
                  <span className="text-[var(--muted)]"> · {t(`links.${key}.desc`)}</span>
                </span>
                <span aria-hidden="true" className="text-[var(--brand-primary)]">→</span>
              </ScopedLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
