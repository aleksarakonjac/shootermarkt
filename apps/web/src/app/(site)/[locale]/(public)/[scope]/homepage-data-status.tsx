"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type HomepageDataStatus = {
  clearFailure: (id: string) => void;
  reportFailure: (id: string, retry: () => void) => void;
  retryAll: () => void;
  hasFailures: boolean;
};

const HomepageDataStatusContext = createContext<HomepageDataStatus | null>(null);

export function HomepageDataStatusProvider({ children }: { children: React.ReactNode }) {
  const [retries, setRetries] = useState<Record<string, () => void>>({});
  const clearFailure = useCallback((id: string) => setRetries((current) => {
    if (!(id in current)) return current;
    const { [id]: _, ...remaining } = current;
    return remaining;
  }), []);
  const reportFailure = useCallback((id: string, retry: () => void) => setRetries((current) => ({ ...current, [id]: retry })), []);
  const retryAll = useCallback(() => Object.values(retries).forEach((retry) => retry()), [retries]);
  const value = useMemo(() => ({ clearFailure, reportFailure, retryAll, hasFailures: Object.keys(retries).length > 0 }), [clearFailure, reportFailure, retryAll, retries]);
  return <HomepageDataStatusContext.Provider value={value}>{children}</HomepageDataStatusContext.Provider>;
}

export function useHomepageDataStatus() {
  const context = useContext(HomepageDataStatusContext);
  if (!context) throw new Error("useHomepageDataStatus must be used within HomepageDataStatusProvider");
  return context;
}

export function HomepageRetryNotice() {
  const { hasFailures, retryAll } = useHomepageDataStatus();
  const t = useTranslations("home");
  const common = useTranslations("common");
  if (!hasFailures) return null;
  return <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"><span className="text-[var(--muted)]">{t("someDataUnavailable")}</span><button type="button" onClick={retryAll} className="font-semibold text-[var(--brand-primary)] hover:underline">{common("retry")}</button></div>;
}
