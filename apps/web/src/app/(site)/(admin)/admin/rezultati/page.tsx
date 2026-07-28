import { RezultatiHub } from "./rezultati-hub";

export const metadata = { title: "Unos rezultata — Admin" };

export default async function RezultatiPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "pdf" || mode === "sss" ? mode : "manual";
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
        >
          Unos rezultata
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Ručni unos ili import iz Excel šablona, PDF biltena, SSS, ISSF i SIUS sistema
        </p>
      </div>
      <RezultatiHub initialMode={initialMode} />
    </div>
  );
}
