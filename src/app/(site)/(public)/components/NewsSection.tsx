"use client";

import Link from "next/link";

// Mock news data – replace with real data source later
const MOCK_NEWS = [
  {
    id: 1,
    category: "Svetski kup",
    title: "Srbija osvaja bronzu na Svetskom kupu u Münchenu",
    summary:
      "Srpski strelci zablistali na međunarodnoj sceni, donoseći odlične rezultate u disciplinama AR i AP.",
    date: "2025-06-20",
    readTime: "3 min",
    tag: "Međunarodno",
    accent: "var(--brand-primary)",
  },
  {
    id: 2,
    category: "Analize",
    title: "Top forma: Ko je u najboljoj formi pred novu sezonu?",
    summary:
      "Analiza rezultata poslednjih mesec dana otkriva iznenađujuće uspon mladih strelaca koji prete veteranima.",
    date: "2025-06-18",
    readTime: "5 min",
    tag: "Analiza",
    accent: "var(--brand-accent)",
  },
  {
    id: 3,
    category: "Domaće takmičenje",
    title: "Državno prventsvo 2025 – šta očekivati?",
    summary:
      "Pregled favorita, discipline koje se takmiče i terminski plan za najveće domaće takmičenje godine.",
    date: "2025-06-15",
    readTime: "4 min",
    tag: "Domaće",
    accent: "var(--success)",
  },
  {
    id: 4,
    category: "Oprema",
    title: "Pregled: Nove puške za sezonu 2025/26",
    summary:
      "Koje novitete donosi nova sezona – od digitalnih nišana do laganih aluokvirnih puški za juniorske kategorije.",
    date: "2025-06-10",
    readTime: "6 min",
    tag: "Oprema",
    accent: "var(--warning)",
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sr-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function NewsSection() {
  const [featured, ...rest] = MOCK_NEWS;

  return (
    <section className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-3">
          <h2
            className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider text-[var(--ink)]"
          >
            Vesti &amp; Analize
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] border border-[var(--border)] px-2 py-0.5 rounded-full">
            Uskoro · Live data
          </span>
        </div>
        <Link
          href="#"
          className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
        >
          Sve vesti →
        </Link>
      </div>

      {/* Grid: featured (wide) + 3 smaller */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Featured card */}
        <article
          className="md:col-span-2 relative flex flex-col justify-end rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] min-h-[240px] group cursor-pointer hover:shadow-lg transition-shadow"
          style={{
            background:
              "linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)",
          }}
        >
          {/* Decorative accent strip */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: featured.accent }}
          />

          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--ink) 0, var(--ink) 1px, transparent 0, transparent 50%)",
              backgroundSize: "12px 12px",
            }}
          />

          <div className="relative z-10 p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                style={{ background: featured.accent }}
              >
                {featured.tag}
              </span>
              <span className="text-[10px] text-[var(--muted)]">
                {featured.category}
              </span>
            </div>

            <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors">
              {featured.title}
            </h3>
            <p className="text-xs text-[var(--muted)] line-clamp-2 max-w-none">
              {featured.summary}
            </p>

            <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--subtle)]">
              <span>{formatDate(featured.date)}</span>
              <span>·</span>
              <span>{featured.readTime} čitanja</span>
            </div>
          </div>
        </article>

        {/* Smaller cards */}
        <div className="flex flex-col gap-4">
          {rest.map((item) => (
            <article
              key={item.id}
              className="relative flex flex-col justify-between rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg)] p-4 group cursor-pointer hover:shadow-md transition-shadow flex-1"
            >
              {/* Accent strip */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: item.accent }}
              />

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: item.accent }}
                  >
                    {item.tag}
                  </span>
                  <span className="text-[9px] text-[var(--muted)] truncate">
                    {item.category}
                  </span>
                </div>
                <h4 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors line-clamp-2">
                  {item.title}
                </h4>
              </div>

              <div className="flex items-center gap-2 mt-2 text-[9px] text-[var(--subtle)]">
                <span>{formatDate(item.date)}</span>
                <span>·</span>
                <span>{item.readTime}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
