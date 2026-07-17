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
        className="flex h-11 items-center justify-center rounded-md border border-transparent px-2.5 text-[0.7rem] font-bold font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:opacity-40 lg:h-8"
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
