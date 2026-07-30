"use client";

import { ScopedLink } from "./ScopedLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useHomepageDataStatus } from "../[scope]/homepage-data-status";

interface ArticleSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string | null;
}

function formatDate(iso: string, locale: string) {
  const localeStr = locale === "en" ? "en-US" : "sr-Latn-RS";
  return new Date(iso).toLocaleDateString(localeStr, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function NewsSection() {
  const locale = useLocale();
  const t = useTranslations("news");
  const tHome = useTranslations("home");
  const common = useTranslations("common");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const autoRetried = useRef(false);
  const { clearFailure, reportFailure } = useHomepageDataStatus();
  const retry = useCallback(() => {
    setState("loading");
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 5000);
    clearFailure("news");
    fetch("/api/news", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("News request failed")))
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Invalid news response");
        setArticles(data);
        setState("ready");
        clearFailure("news");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError" && !timedOut) return;
        setState("error");
        reportFailure("news", retry);
      })
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [attempt, clearFailure, reportFailure, retry]);

  useEffect(() => {
    if (state !== "error" || autoRetried.current) return;
    autoRetried.current = true;
    const timeout = window.setTimeout(retry, 3_000);
    return () => window.clearTimeout(timeout);
  }, [retry, state]);

  return (
    <section className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider text-[var(--ink)]">
          {t("title")}
        </h2>
        <ScopedLink
          href="/vesti"
          className="shrink-0 text-xs font-semibold text-[var(--brand-primary)] hover:underline"
        >
          {tHome("allNewsLink")}
        </ScopedLink>
      </div>

      {state === "loading" ? (
        <div aria-busy="true" className="h-56 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : state === "error" ? (
        <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl bg-[var(--surface)] p-8 text-center text-sm">
          <p className="text-[var(--muted)]">{common("error")}</p>
          <button type="button" onClick={retry} className="font-semibold text-[var(--brand-primary)] hover:underline">{common("retry")}</button>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
          {tHome("noArticles")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Featured card */}
          {(() => {
            const featured = articles[0];
            return (
              <ScopedLink
                href={`/vesti/${featured.slug}`}
                className="group flex min-h-[240px] flex-col justify-end rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--brand-primary)] md:col-span-2"
              >
                <div className="flex flex-col gap-2">
                  <span
                    className="self-start rounded bg-[var(--brand-primary)] px-2 py-1 text-xs font-extrabold uppercase tracking-wider text-white"
                  >
                    {tHome("newsBadge")}
                  </span>
                  <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors">
                    {featured.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)] line-clamp-2">
                    {featured.excerpt}
                  </p>
                  {featured.publishedAt && (
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {formatDate(featured.publishedAt, locale)}
                    </div>
                  )}
                </div>
              </ScopedLink>
            );
          })()}

          {/* Smaller cards */}
          <div className="flex flex-col gap-4">
            {articles.slice(1, 4).map((item) => {
              return (
                <ScopedLink
                  key={item.id}
                  href={`/vesti/${item.slug}`}
                  className="group flex flex-1 flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 transition-colors hover:border-[var(--brand-primary)]"
                >
                  <div className="flex flex-col gap-1.5">
                    <span
                      className="self-start rounded bg-[var(--brand-primary)] px-1.5 py-1 text-xs font-extrabold uppercase tracking-wider text-white"
                    >
                      {tHome("newsBadge")}
                    </span>
                    <h4 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors line-clamp-2">
                      {item.title}
                    </h4>
                  </div>
                  {item.publishedAt && (
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {formatDate(item.publishedAt, locale)}
                    </div>
                  )}
                </ScopedLink>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
