import type { CSSProperties } from "react";

interface FormaScoreMarkProps {
  className?: string;
  style?: CSSProperties;
  size?: "sm" | "md" | "base" | "lg" | "xl";
}

const SIZE = {
  sm:   { forma: "0.75rem",  score: "0.725rem" },
  md:   { forma: "0.875rem", score: "0.85rem"  },
  base: { forma: "1.1rem",   score: "1.065rem" },
  lg:   { forma: "1.5rem",   score: "1.45rem"  },
  xl:   { forma: "2rem",     score: "1.93rem"  },
};

export function FormaScoreMark({ className, style, size = "md" }: FormaScoreMarkProps) {
  const s = SIZE[size];
  return (
    <span
      className={className}
      style={{ whiteSpace: "nowrap", lineHeight: 1, ...style }}
      aria-label="FormaScore"
    >
      <span
        style={{
          fontFamily: "var(--font-barlow-condensed, sans-serif)",
          fontWeight: 800,
          fontSize: s.forma,
          letterSpacing: "-0.01em",
          color: "var(--ink)",
          textTransform: "uppercase",
        }}
      >
        Forma
      </span>
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          fontWeight: 800,
          fontSize: s.score,
          letterSpacing: "-0.04em",
          color: "var(--brand-primary)",
        }}
      >
        Score
      </span>
    </span>
  );
}
