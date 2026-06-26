"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";

export interface TickerItem {
  id: number;
  name: string;
  date: string;
  level: string;
  status: "LIVE" | "KRAJ" | "NAJAVA";
  detailText: string; // e.g. "Marko P. (628.5)" or "Novi Sad"
}

interface TickerProps {
  items: TickerItem[];
}

export function Ticker({ items }: TickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    
    // Slow, readable speed: 30 pixels per second
    const speed = 25; 

    const scrollLoop = (time: number) => {
      if (!isPaused && container) {
        const delta = (time - lastTime) / 1000;
        container.scrollLeft += speed * delta;

        // Infinite loop reset
        if (container.scrollLeft >= container.scrollWidth / 2) {
          container.scrollLeft -= container.scrollWidth / 2;
        }
      }
      lastTime = time;
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [isPaused, items]);

  const handleInteractionStart = () => {
    setIsPaused(true);
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  };

  const handleInteractionEnd = () => {
    // Resume scrolling after 4 seconds of inactivity
    resumeTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 4000);
  };

  if (!items || items.length === 0) return null;

  // Duplicate items for infinite marquee loop
  const duplicatedItems = [...items, ...items];

  return (
    <div className="w-full bg-[var(--brand-accent)] text-white border-b border-[var(--border)] overflow-hidden">
      <div className="mx-auto max-w-7xl">
        <div
          ref={containerRef}
          onMouseEnter={handleInteractionStart}
          onMouseLeave={handleInteractionEnd}
          onTouchStart={handleInteractionStart}
          onTouchEnd={handleInteractionEnd}
          onPointerDown={handleInteractionStart}
          onPointerUp={handleInteractionEnd}
          className="flex items-center h-11 overflow-x-auto whitespace-nowrap scrollbar-none select-none touch-pan-x cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: "none" }}
        >
          {duplicatedItems.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="inline-flex items-center gap-3 px-6 py-2 border-r border-[rgba(255,255,255,0.15)] last:border-0 h-full text-xs font-medium"
            >
              {/* Status Badge */}
              {item.status === "LIVE" && (
                <span className="inline-flex items-center gap-1 bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded-[3px] text-[9px] tracking-wide animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white block"></span>
                  UŽIVO
                </span>
              )}
              {item.status === "KRAJ" && (
                <span className="bg-[var(--brand-primary)] text-white px-1.5 py-0.5 rounded-[3px] font-bold text-[9px] tracking-wide">
                  ZAVRŠENO
                </span>
              )}
              {item.status === "NAJAVA" && (
                <span className="bg-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.85)] px-1.5 py-0.5 rounded-[3px] font-semibold text-[9px] tracking-wide">
                  NAJAVA
                </span>
              )}

              {/* Match details */}
              <div className="flex items-center gap-2">
                <span className="text-[rgba(255,255,255,0.6)] font-semibold text-[10px] uppercase">
                  {item.level}
                </span>
                <span className="font-bold max-w-[120px] truncate" title={item.name}>
                  {item.name}
                </span>
                <span className="font-mono text-[var(--brand-primary-light)] font-bold bg-[rgba(194,0,0,0.2)] px-1.5 py-0.5 rounded">
                  {item.detailText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
