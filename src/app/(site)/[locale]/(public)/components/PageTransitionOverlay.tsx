"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";

export function PageTransitionOverlay({ visible }: { visible: boolean }) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  if (!mounted || !visible) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes _splash-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes _ring-pulse {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.07); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes _splash-in  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes _ring-pulse { 0%, 100% { opacity: 0.4; } }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-[var(--bg)]"
        style={{ animation: "_splash-in 90ms ease-out both" }}
        aria-live="polite"
        aria-label="Učitavanje"
        role="status"
      >
        {/* Wordmark */}
        <div className="flex items-baseline gap-0 select-none">
          <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[2rem] uppercase tracking-tight leading-none text-[var(--brand-primary)]">
            Shooter
          </span>
          <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[2rem] uppercase tracking-tight leading-none text-[var(--ink)]">
            markt
          </span>
        </div>

        {/* Bullseye */}
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
          <circle
            cx="26" cy="26" r="22"
            stroke="var(--brand-primary)" strokeWidth="1.5"
            style={{ animation: "_ring-pulse 1.6s ease-in-out 0.32s infinite", transformOrigin: "26px 26px" }}
          />
          <circle
            cx="26" cy="26" r="14"
            stroke="var(--brand-primary)" strokeWidth="1.5"
            style={{ animation: "_ring-pulse 1.6s ease-in-out 0.16s infinite", transformOrigin: "26px 26px" }}
          />
          <circle
            cx="26" cy="26" r="6"
            stroke="var(--brand-primary)" strokeWidth="1.5"
            style={{ animation: "_ring-pulse 1.6s ease-in-out 0s infinite", transformOrigin: "26px 26px" }}
          />
          <circle cx="26" cy="26" r="2.2" fill="var(--brand-primary)" opacity="0.75" />
        </svg>
      </div>
    </>,
    document.body
  );
}
