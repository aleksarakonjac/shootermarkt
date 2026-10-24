"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTransition, Suspense } from "react";
import { PageTransitionOverlay, startPageTransitionSplash } from "./PageTransitionOverlay";
import { setPrefCookie } from "@/lib/client-prefs";

function LocaleSwitcherInner() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: "sr" | "en") {
    if (next === locale) return;
    const query = Object.fromEntries(searchParams.entries());
    setPrefCookie("pref_locale", next);
    startPageTransitionSplash();
    startTransition(() => {
      router.replace({ pathname, query }, { locale: next });
    });
  }

  // Oba jezika vidljiva + globus, da bude jasno da je ovo izbor jezika sajta
  return (
    <>
      <PageTransitionOverlay visible={isPending} />
      <div
        role="group"
        aria-label={t("label")}
        title={t("label")}
        className="flex h-8 items-center gap-2 rounded-md pl-1.5 text-[0.7rem] font-bold font-[family-name:var(--font-jetbrains-mono)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted)]" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <div className="flex h-8 items-stretch rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
          {(["sr", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => switchTo(l)}
              disabled={isPending}
              aria-pressed={locale === l}
              aria-label={l === "sr" ? t("switchToSr") : t("switchToEn")}
              className={`flex items-center rounded-md px-2 uppercase transition-colors disabled:opacity-40 ${
                locale === l
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function LocaleSwitcher() {
  return (
    <Suspense fallback={null}>
      <LocaleSwitcherInner />
    </Suspense>
  );
}
