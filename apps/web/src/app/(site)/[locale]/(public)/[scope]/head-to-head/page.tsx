export const revalidate = 300;

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import { type Scope } from "@/lib/scope";
import { ScopedLink } from "../../components/ScopedLink";
import { H2HClient, type H2HClientLabels } from "./H2HClient";

type Props = {
  params: Promise<{ scope: Scope }>;
  searchParams: Promise<{ a?: string; b?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scope } = await params;
  const locale = await getLocale();
  return {
    title: (locale === "en" ? "Direct Comparison" : "Direktno poređenje") + " — Shootermarkt",
    alternates: buildAlternates(locale, scope, "/head-to-head"),
  };
}

export default async function HeadToHeadPage({ params: _params, searchParams }: Props) {
  const { a, b } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("ranking");

  const initialP1 = a ? parseInt(a) : undefined;
  const initialP2 = b ? parseInt(b) : undefined;

  const h2hTitle = locale === "en" ? "Direct Comparison" : "Direktno poređenje";
  const h2hSubtitle = locale === "en"
    ? "Compare two shooters across all their shared competitions"
    : "Uporedi dva strelca na zajedničkim takmičenjima";

  const labels: H2HClientLabels = {
    h2hPickPrompt:       t("h2hPickPrompt"),
    h2hSwap:             t("h2hSwap"),
    h2hPickBoth:         t("h2hPickBoth"),
    h2hCommonMeets:      t("h2hCommonMeets"),
    h2hNoCommonMeets:    t("h2hNoCommonMeets"),
    h2hStat_forma:       t("h2hStat_forma"),
    h2hStat_peak:        t("h2hStat_peak"),
    h2hStat_best3:       t("h2hStat_best3"),
    h2hStat_seasonAvg:   t("h2hStat_seasonAvg"),
    h2hStat_recent3:     t("h2hStat_recent3"),
    h2hStat_appearances: t("h2hStat_appearances"),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          {h2hTitle}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">{h2hSubtitle}</p>
      </div>

      <H2HClient labels={labels} initialP1={initialP1} initialP2={initialP2} />

      <div className="mt-8 pt-6 border-t border-[var(--border)]">
        <ScopedLink href="/rangiranje" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
          ← {locale === "en" ? "Back to rankings" : "Nazad na rangiranje"}
        </ScopedLink>
      </div>
    </div>
  );
}
