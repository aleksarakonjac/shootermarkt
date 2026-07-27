import { CalendarModule } from "../components/CalendarModule";
import { NewsSection } from "../components/NewsSection";
import { buildAlternates } from "@/i18n/alternates";
import { getLocale, getTranslations } from "next-intl/server";
import { type Scope } from "@/lib/scope";
import { getHomepageMain } from "@/lib/homepage-data";
import { Suspense } from "react";
import { QuickH2HClient } from "./quick-h2h-client";
import { HomepageMainClient, HomepageTickerClient } from "./homepage-client-blocks";
import { HomepageDataStatusProvider, HomepageRetryNotice } from "./homepage-data-status";
import "./homepage.css";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("home.metadata"), getLocale()]);
  return { title: t("title"), description: t("description"), alternates: buildAlternates(locale, scope, "/") };
}

async function HomepageMain({ scope }: { scope: Scope }) {
  return <HomepageMainClient initialData={await getHomepageMain(scope)} />;
}

function HomepageMainLoading() {
  return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
}

export default async function HomePage({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  return <HomepageDataStatusProvider>
    <HomepageTickerClient />
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-8 sm:px-6 lg:px-8">
      <HomepageRetryNotice />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <main className="lg:col-span-2"><Suspense fallback={<HomepageMainLoading />}><HomepageMain scope={scope} /></Suspense></main>
        <aside className="flex flex-col gap-8"><CalendarModule /><QuickH2HClient /></aside>
      </div>
      <div className="mt-8"><NewsSection /></div>
    </div>
  </HomepageDataStatusProvider>;
}
