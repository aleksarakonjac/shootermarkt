import React from "react";

interface SparklineProps {
  scores: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export function Sparkline({
  scores,
  width = 80,
  height = 24,
  strokeColor,
  strokeWidth = 2,
}: SparklineProps) {
  if (!scores || scores.length < 2) {
    return <span className="text-[var(--subtle)] text-xs">—</span>;
  }

  // Reverse so oldest is left, newest is right
  const data = [...scores].reverse();

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  // Map to SVG coordinates
  const padding = 2;
  const points = data.map((score, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    // SVG y=0 is top, so invert the value
    const y =
      height -
      padding -
      ((score - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Decide stroke color based on overall direction
  const isUp = data[data.length - 1] >= data[0];
  const finalStrokeColor =
    strokeColor || (isUp ? "var(--success)" : "var(--brand-primary)");

  return (
    <svg
      width={width}
      height={height}
      className="inline-block overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={finalStrokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
      {/* Dynamic pulse dot for the latest value */}
      <circle
        cx={points[points.length - 1].split(",")[0]}
        cy={points[points.length - 1].split(",")[1]}
        r="2"
        fill={finalStrokeColor}
      />
    </svg>
  );
}
