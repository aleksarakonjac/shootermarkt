"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { FormaScoreMark } from "./FormaScoreMark";

interface FormaScoreHeadingProps {
  locale?: string;
}

interface FormaScoreInfoProps extends FormaScoreHeadingProps {
  heading?: string;
  description?: string;
  ariaLabel?: string;
  align?: "left" | "center" | "right";
  placement?: "top" | "bottom";
  buttonMarginTop?: number;
  className?: string;
}

const INFO: Record<string, string> = {
  sr: "FORMAScore je prognoza sledećeg rezultata. Noviji i jači nastupi imaju veću težinu, a trend projektuje trenutni nivo unapred. Pouzdanost i konzistentnost se prikazuju odvojeno.",
  en: "FORMAScore predicts the next result. More recent and stronger performances carry greater weight, while trend projects the current level forward. Reliability and consistency are shown separately.",
};

export function FormaScoreInfo({ locale = "sr", inverted = false, heading, description, ariaLabel, align = "left", placement = "bottom", buttonMarginTop = 3, className }: FormaScoreInfoProps & { inverted?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number; width: number } | null>(null);

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

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const button = btnRef.current;
      const panel = panelRef.current;
      if (!button || !panel) return;
      const margin = 8;
      const width = Math.min(288, window.innerWidth - margin * 2);
      const height = panel.offsetHeight;
      const rect = button.getBoundingClientRect();
      const preferredTop = placement === "top" ? rect.top - height - margin : rect.bottom + margin;
      const flippedTop = placement === "top" ? rect.bottom + margin : rect.top - height - margin;
      const maxTop = Math.max(margin, window.innerHeight - height - margin);
      const top = Math.min(maxTop, Math.max(margin, preferredTop < margin || preferredTop + height > window.innerHeight - margin ? flippedTop : preferredTop));
      const preferredLeft = align === "right" ? rect.right - width : align === "center" ? rect.left + rect.width / 2 - width / 2 : rect.left;
      const left = Math.min(window.innerWidth - width - margin, Math.max(margin, preferredLeft));
      setPanelPosition({ left, top, width });
    };
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, open, placement]);

  return <div
    className={className}
    style={{ position: "relative", display: "flex", alignItems: "center" }}
    onMouseEnter={() => { setPanelPosition(null); setOpen(true); }}
    onMouseLeave={() => setOpen(false)}
  >
    <button
      ref={btnRef}
      type="button"
      onClick={() => setOpen((value) => { if (!value) setPanelPosition(null); return !value; })}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      aria-label={ariaLabel ?? (locale === "en" ? "What is FORMAScore?" : "Šta je FORMAScore?")}
      aria-expanded={open}
      aria-controls={panelId}
      style={{
        width: 17, height: 17, borderRadius: "50%",
        border: `1.5px solid ${inverted ? "rgba(255,255,255,0.75)" : "var(--muted)"}`,
        color: inverted ? "white" : "var(--muted)", background: "none",
        fontSize: "0.65rem", fontWeight: 700, cursor: "pointer", lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        transition: "opacity 0.15s", opacity: open ? 1 : 0.75, marginTop: buttonMarginTop,
      }}
    >
      i
    </button>

    {open && <div ref={panelRef} id={panelId} role="tooltip" style={{ position: "fixed", left: panelPosition?.left ?? 0, top: panelPosition?.top ?? 0, width: panelPosition?.width ?? "min(288px, calc(100vw - 1rem))", visibility: panelPosition ? "visible" : "hidden", zIndex: "var(--z-tooltip)", fontFamily: "var(--font-sans)", textTransform: "none" }}>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        {heading && <p className="mb-2" style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>{heading}</p>}
        {!heading && <div className="mb-2 flex items-baseline gap-1">
          <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>{locale === "en" ? "What is" : "Šta je"}</span>
          <FormaScoreMark size="md" />
          <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>?</span>
        </div>}
        <p style={{ color: "var(--ink)", fontSize: "0.8rem", lineHeight: 1.6, fontWeight: 400 }}>{description ?? INFO[locale] ?? INFO.sr}</p>
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
