import Link from "next/link";
import { getPublishedArticles } from "@/lib/cms/get-articles";

const ACCENTS = [
  "var(--brand-primary)",
  "var(--brand-accent)",
  "var(--success)",
  "var(--warning)",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sr-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function NewsSection() {
  const articles = await getPublishedArticles().catch(() => []);

  return (
    <section className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-baseline justify-between">
        <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider text-[var(--ink)]">
          Vesti &amp; Analize
        </h2>
        {articles.length > 0 && (
          <Link
            href="/vesti"
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          >
            Sve vesti →
          </Link>
        )}
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
          Uskoro — prve vesti i analize
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Featured card */}
          {(() => {
            const featured = articles[0];
            const accent = ACCENTS[0];
            return (
              <Link
                href={`/vesti/${featured.slug}`}
                className="md:col-span-2 relative flex flex-col justify-end rounded-xl overflow-hidden border border-[var(--border)] min-h-[240px] group hover:shadow-lg transition-shadow"
                style={{
                  background:
                    "linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)",
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: accent }}
                />
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, var(--ink) 0, var(--ink) 1px, transparent 0, transparent 50%)",
                    backgroundSize: "12px 12px",
                  }}
                />
                <div className="relative z-10 p-5 flex flex-col gap-2">
                  <span
                    className="self-start text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                    style={{ background: accent }}
                  >
                    Vest
                  </span>
                  <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors">
                    {featured.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)] line-clamp-2">
                    {featured.excerpt}
                  </p>
                  {featured.publishedAt && (
                    <div className="mt-2 text-[10px] text-[var(--subtle)]">
                      {formatDate(featured.publishedAt)}
                    </div>
                  )}
                </div>
              </Link>
            );
          })()}

          {/* Smaller cards */}
          <div className="flex flex-col gap-4">
            {articles.slice(1, 4).map((item, i) => {
              const accent = ACCENTS[(i + 1) % ACCENTS.length];
              return (
                <Link
                  key={item.id}
                  href={`/vesti/${item.slug}`}
                  className="relative flex flex-col justify-between rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg)] p-4 group hover:shadow-md transition-shadow flex-1"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: accent }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <span
                      className="self-start text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: accent }}
                    >
                      Vest
                    </span>
                    <h4 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors line-clamp-2">
                      {item.title}
                    </h4>
                  </div>
                  {item.publishedAt && (
                    <div className="mt-2 text-[9px] text-[var(--subtle)]">
                      {formatDate(item.publishedAt)}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
