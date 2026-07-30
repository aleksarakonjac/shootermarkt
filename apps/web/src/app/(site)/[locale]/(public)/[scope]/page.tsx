import { CalendarModule } from "../components/CalendarModule";
import { SidebarCompetitionNews } from "../components/SidebarCompetitionNews";
import { buildAlternates } from "@/i18n/alternates";
import { getLocale, getTranslations } from "next-intl/server";
import { type Scope } from "@/lib/scope";
import { getHomepageMain, type HomepageMainData } from "@/lib/homepage-data";
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

async function HomepageMain({ data }: { data: Promise<HomepageMainData> }) {
  return <HomepageMainClient initialData={await data} />;
}

async function HomepageSidebarNews({ data }: { data: Promise<HomepageMainData> }) {
  const [homepageData, locale] = await Promise.all([data, getLocale()]);
  return <SidebarCompetitionNews competitionIds={homepageData.recent.map((competition) => competition.id)} locale={locale} />;
}

function HomepageMainLoading() {
  return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
}

export default async function HomePage({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  const homepageData = getHomepageMain(scope);
  return <HomepageDataStatusProvider>
    <HomepageTickerClient />
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-8 sm:px-6 lg:px-8">
      <HomepageRetryNotice />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <main className="lg:col-span-2"><Suspense fallback={<HomepageMainLoading />}><HomepageMain data={homepageData} /></Suspense></main>
        <aside className="flex flex-col gap-8"><Suspense fallback={null}><HomepageSidebarNews data={homepageData} /></Suspense><CalendarModule /><QuickH2HClient /></aside>
      </div>
    </div>
  </HomepageDataStatusProvider>;
}
