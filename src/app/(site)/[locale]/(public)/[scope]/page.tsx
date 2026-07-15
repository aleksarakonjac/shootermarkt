import { CalendarModule } from "../components/CalendarModule";
import { NewsSection } from "../components/NewsSection";
import { buildAlternates } from "@/i18n/alternates";
import { getLocale, getTranslations } from "next-intl/server";
import { type Scope } from "@/lib/scope";
import { QuickH2HClient } from "./quick-h2h-client";
import { HomepageClubsClient, HomepageMainClient, HomepageTickerClient } from "./homepage-client-blocks";
import "./homepage.css";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("home.metadata"), getLocale()]);
  return { title: t("title"), description: t("description"), alternates: buildAlternates(locale, scope, "/") };
}

export default function HomePage() {
  return <>
    <HomepageTickerClient />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <main className="lg:col-span-2"><HomepageMainClient /></main>
        <aside className="flex flex-col gap-8"><CalendarModule competitions={[]} /><HomepageClubsClient /><QuickH2HClient /></aside>
      </div>
      <div className="mt-8"><NewsSection /></div>
    </div>
  </>;
}
