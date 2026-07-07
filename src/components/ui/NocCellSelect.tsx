"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { NOC_LIST } from "@/lib/noc-list";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function NocCellSelect({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = NOC_LIST.filter(
    (n) =>
      n.noc.toLowerCase().includes(search.toLowerCase()) ||
      n.name.toLowerCase().includes(search.toLowerCase())
  );

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setSearch("");
    setOpen(true);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Recompute rect on scroll/resize so panel tracks
  useEffect(() => {
    if (!open) return;
    function update() {
      setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const panelStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
        minWidth: 160,
      }
    : { display: "none" };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        className="w-full border-0 border-b border-[var(--border)] bg-transparent px-1 py-0.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors disabled:opacity-40 text-center font-[family-name:var(--font-jetbrains-mono)] uppercase tabular-nums"
      >
        {value || <span className="text-[var(--subtle)]">SRB</span>}
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden"
        >
          <div className="p-1.5 border-b border-[var(--border)]">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SRB, GER..."
              className="w-full rounded px-2 py-1 text-xs text-[var(--ink)] bg-[var(--surface)] focus:outline-none placeholder:text-[var(--subtle)]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.slice(0, 60).map((n) => (
              <button
                key={n.noc}
                type="button"
                onClick={() => { onChange(n.noc); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface)] transition-colors flex items-center gap-2"
                style={{
                  fontWeight: n.noc === value ? 700 : 400,
                  color: n.noc === value ? "var(--brand-primary)" : "var(--ink)",
                }}
              >
                <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold w-8 shrink-0">{n.noc}</span>
                <span className="text-[var(--muted)] truncate">{n.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--subtle)]">Nema rezultata</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
