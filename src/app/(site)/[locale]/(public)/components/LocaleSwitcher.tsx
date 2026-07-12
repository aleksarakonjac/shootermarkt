"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTransition, Suspense } from "react";
import { PageTransitionOverlay } from "./PageTransitionOverlay";

function LocaleSwitcherInner() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = locale === "sr" ? "en" : "sr";
    const query = Object.fromEntries(searchParams.entries());
    startTransition(() => {
      router.replace({ pathname, query }, { locale: next });
    });
  }

  return (
    <>
      <PageTransitionOverlay visible={isPending} />
      <button
        onClick={toggle}
        disabled={isPending}
        aria-label={locale === "sr" ? t("switchToEn") : t("switchToSr")}
        className="flex items-center justify-center h-8 px-2.5 rounded-md text-[0.7rem] font-bold font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors select-none disabled:opacity-40 border border-transparent hover:border-[var(--border)]"
      >
        {locale === "sr" ? "EN" : "SR"}
      </button>
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
