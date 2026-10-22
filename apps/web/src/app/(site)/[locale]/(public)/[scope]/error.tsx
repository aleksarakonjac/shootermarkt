"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ScopedLink } from "../components/ScopedLink";

// Header i footer (layout iznad) ostaju; pada samo sadržaj strane.
export default function ScopeError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const common = useTranslations("common");
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-[var(--muted)]">{common("error")}</p>
      <div className="flex items-center gap-6 text-sm">
        <button type="button" onClick={() => unstable_retry()} className="font-semibold text-[var(--brand-primary)] hover:underline">{common("retry")}</button>
        <ScopedLink href="/" className="text-[var(--muted)] hover:text-[var(--ink)]">{common("backToHome")}</ScopedLink>
      </div>
      {error.digest && <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--subtle)]">{error.digest}</p>}
    </div>
  );
}
