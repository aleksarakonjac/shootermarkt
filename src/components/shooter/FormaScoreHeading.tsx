"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FormaScoreMark } from "./FormaScoreMark";

interface FormaScoreHeadingProps {
  locale?: string;
}

const INFO: Record<string, string> = {
  sr: "FormaScore je prognoza sledećeg rezultata. Noviji i jači nastupi imaju veću težinu, a trend projektuje trenutni nivo unapred. Pouzdanost i konzistentnost se prikazuju odvojeno.",
  en: "FormaScore predicts the next result. More recent and stronger performances carry greater weight, while trend projects the current level forward. Reliability and consistency are shown separately.",
};

export function FormaScoreInfo({ locale = "sr", inverted = false }: FormaScoreHeadingProps & { inverted?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return <div
    style={{ position: "relative", display: "flex", alignItems: "center" }}
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => setOpen(false)}
  >
    <button
      ref={btnRef}
      type="button"
      onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      aria-label={locale === "en" ? "What is FormaScore?" : "Šta je FormaScore?"}
      aria-expanded={open}
      aria-controls={panelId}
      style={{
        width: 17, height: 17, borderRadius: "50%",
        border: `1.5px solid ${inverted ? "rgba(255,255,255,0.75)" : "var(--muted)"}`,
        color: inverted ? "white" : "var(--muted)", background: "none",
        fontSize: "0.65rem", fontWeight: 700, cursor: "pointer", lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        transition: "opacity 0.15s", opacity: open ? 1 : 0.75, marginTop: "3px",
      }}
    >
      i
    </button>

    {open && <div ref={panelRef} id={panelId} role="tooltip" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 288, zIndex: "var(--z-tooltip)", fontFamily: "var(--font-sans)" }}>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <div className="mb-2 flex items-baseline gap-1">
          <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>{locale === "en" ? "What is" : "Šta je"}</span>
          <FormaScoreMark size="md" />
          <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>?</span>
        </div>
        <p style={{ color: "var(--ink)", fontSize: "0.8rem", lineHeight: 1.6, fontWeight: 400 }}>{INFO[locale] ?? INFO.sr}</p>
      </div>
    </div>}
  </div>;
}

export function FormaScoreHeading({ locale = "sr" }: FormaScoreHeadingProps) {
  return <h2 className="mb-4 flex items-center gap-1">
    <FormaScoreMark size="lg" />
    <FormaScoreInfo locale={locale} />
  </h2>;
}
