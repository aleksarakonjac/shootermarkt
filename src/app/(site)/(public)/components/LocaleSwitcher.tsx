"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageTransitionOverlay } from "./PageTransitionOverlay";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = locale === "sr" ? "en" : "sr";
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
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
