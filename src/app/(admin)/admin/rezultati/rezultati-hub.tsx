"use client";

import { useState } from "react";
import { ManualMode } from "./modes/ManualMode";
import { PdfMode }    from "./modes/PdfMode";
import { SssMode }    from "./modes/SssMode";
import { IssfMode }   from "./modes/IssfMode";
import { SiusMode }   from "./modes/SiusMode";

type Mode = "manual" | "pdf" | "sss" | "issf" | "sius";

interface ModeConfig {
  id: Mode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const MODES: ModeConfig[] = [
  {
    id: "manual",
    label: "Ručni unos",
    description: "Unesi rezultate red po red",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M3 14h12M9 3v8M6 8l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "pdf",
    label: "PDF bilten",
    description: "Upload PDF → Gemini parsiranje",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 2h7l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M11 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 9h6M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "sss",
    label: "SSS bilten",
    description: "Bilteni sa serbianshooting.rs",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 6.5C6 5.67 6.67 5 7.5 5h.5a2 2 0 010 4H7a2 2 0 000 4h.5c.83 0 1.5-.67 1.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "issf",
    label: "ISSF",
    description: "Rezultati sa results.issf-sports.info",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 2a7 7 0 100 14A7 7 0 009 2z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 9h14M9 2c-2 2-3.5 4.4-3.5 7S7 14 9 16M9 2c2 2 3.5 4.4 3.5 7S11 14 9 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "sius",
    label: "SIUS",
    description: "PDF-ovi sa results.sius.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 3V2M12 3V2M2 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5.5 10.5h2M10.5 10.5h2M5.5 13h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export function RezultatiHub() {
  const [mode, setMode] = useState<Mode>("manual");
  const current = MODES.find((m) => m.id === mode)!;

  return (
    <div className="space-y-6">
      {/* Mode picker */}
      <div className="grid grid-cols-5 gap-2">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all duration-150"
              style={{
                borderColor: active ? "var(--brand-primary)" : "var(--border)",
                background: active ? "var(--brand-primary-light)" : "var(--bg)",
                color: active ? "var(--brand-primary)" : "var(--muted)",
              }}
            >
              <span className="shrink-0">{m.icon}</span>
              <span className="text-xs font-semibold leading-tight">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active mode header */}
      <div className="flex items-center gap-3 pb-1 border-b border-[var(--border)]">
        <span className="text-[var(--brand-primary)]">{current.icon}</span>
        <div>
          <h2 className="font-semibold text-[var(--ink)] text-sm">{current.label}</h2>
          <p className="text-xs text-[var(--muted)]">{current.description}</p>
        </div>
      </div>

      {/* Mode content */}
      {mode === "manual" && <ManualMode />}
      {mode === "pdf"    && <PdfMode />}
      {mode === "sss"    && <SssMode />}
      {mode === "issf"   && <IssfMode />}
      {mode === "sius"   && <SiusMode />}
    </div>
  );
}
