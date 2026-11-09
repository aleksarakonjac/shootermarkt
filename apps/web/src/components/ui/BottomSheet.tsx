"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useUiLocale } from "@/hooks/use-ui-locale";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Mobile bottom sheet: focus trap, Esc, scroll lock, drag-down to dismiss, focus returns to the opener. */
export function BottomSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const en = useUiLocale() === "en";

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-modal)] flex items-end"
          style={{ background: "oklch(0 0 0 / 0.5)" }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--bg)] shadow-lg outline-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={reduced ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduced ? undefined : { y: "100%" }}
            transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            drag={reduced ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 600) onClose(); }}
          >
            <div className="flex shrink-0 justify-center pt-2" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={en ? "Close" : "Zatvori"}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-lg text-[var(--muted)] hover:text-[var(--ink)]"
            >
              ✕
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
