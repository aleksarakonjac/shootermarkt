"use client";

import { useState, useRef, useEffect } from "react";
import { FormaScoreMark } from "./FormaScoreMark";

interface FormaScoreHeadingProps {
  locale?: string;
}

const INFO: Record<string, string> = {
  sr: "FormaScore meri trenutnu formu strelca na osnovu rezultata sa novijih takmičenja. Noviji nastupi imaju veći uticaj, a uzima se u obzir i konzistentnost tokom vremena.",
  en: "FormaScore measures a shooter's current form based on recent competition results. More recent performances carry greater weight, and consistency over time is also factored in.",
};

export function FormaScoreHeading({ locale = "sr" }: FormaScoreHeadingProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const text = INFO[locale] ?? INFO.sr;

  return (
    <h2 className="mb-4 flex items-center gap-1">
      <FormaScoreMark size="lg" />

      {/* Wrapper gives the absolute panel its reference point */}
      <div
        style={{ position: "relative", display: "flex", alignItems: "center" }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          ref={btnRef}
          onClick={() => setOpen(o => !o)}
          aria-label="Šta je FormaScore?"
          style={{
            width: 17, height: 17, borderRadius: "50%",
            border: "1.5px solid var(--muted)",
            color: "var(--muted)", background: "none",
            fontSize: "0.65rem", fontWeight: 700,
            cursor: "pointer", lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "opacity 0.15s",
            opacity: open ? 1 : 0.6,
            marginTop: "3px",
          }}
        >
          i
        </button>

        {open && (
          <div ref={panelRef} style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: 288,
            zIndex: 50,
          }}>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl px-4 py-3">
              <div className="mb-2 flex items-baseline gap-1">
                <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>
                  {locale === "en" ? "What is" : "Šta je"}
                </span>
                <FormaScoreMark size="md" />
                <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>?</span>
              </div>
              <p style={{ color: "var(--ink)", fontSize: "0.8rem", lineHeight: 1.6, fontWeight: 400 }}>
                {text}
              </p>
            </div>
          </div>
        )}
      </div>
    </h2>
  );
}
