import { Suspense } from "react";
import { CalendarModule } from "../components/CalendarModule";
import { NewsSection } from "../components/NewsSection";
import { buildAlternates } from "@/i18n/alternates";
import { getLocale, getTranslations } from "next-intl/server";
import { type Scope } from "@/lib/scope";
import { QuickH2HClient } from "./quick-h2h-client";
import { HomepageClubLeaderboard, HomepageMain, HomepageTicker } from "./homepage-blocks";
import "./homepage.css";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("home.metadata"), getLocale()]);
  return { title: t("title"), description: t("description"), alternates: buildAlternates(locale, scope, "/") };
}

export default async function HomePage({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  return <>
    <Suspense fallback={<div className="h-10 animate-pulse bg-[var(--surface)]" />}><HomepageTicker scope={scope} /></Suspense>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <main className="lg:col-span-2"><Suspense fallback={<BlockSkeleton />}><HomepageMain scope={scope} /></Suspense></main>
        <aside className="flex flex-col gap-8"><CalendarModule competitions={[]} /><Suspense fallback={<BlockSkeleton />}><HomepageClubLeaderboard scope={scope} /></Suspense><QuickH2HClient /></aside>
      </div>
      <Suspense fallback={<BlockSkeleton />}><div className="mt-8"><NewsSection /></div></Suspense>
    </div>
  </>;
}

function BlockSkeleton() {
  return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
}
