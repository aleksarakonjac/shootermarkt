import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedArticles } from "@/lib/cms/get-articles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vesti" };

export default async function VestiPage() {
  const articles = await getPublishedArticles();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold mb-6">Vesti</h1>
      <div className="grid gap-4">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/vesti/${article.slug}`}
            className="block rounded-lg border border-[var(--border)] p-4 hover:border-[var(--brand-primary)] transition-colors"
          >
            <h2 className="font-semibold text-lg">{article.title}</h2>
            <p className="text-sm text-[var(--muted)]">{article.excerpt}</p>
          </Link>
        ))}
        {articles.length === 0 && (
          <p className="text-[var(--muted)]">Trenutno nema objavljenih vesti.</p>
        )}
      </div>
    </div>
  );
}
