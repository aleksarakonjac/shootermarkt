"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion } from "framer-motion";
import { useUiLocale } from "@/hooks/use-ui-locale";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Mobile bottom sheet: focus trap, Esc (top layer only), scroll lock, inert background,
 * drag-down to dismiss from the handle, focus returns to the opener. Closes itself when the
 * viewport grows to desktop width.
 */
export function BottomSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reduced = useReducedMotion();
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const en = useUiLocale() === "en";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Deps are [open] only: parent re-renders (live results, expand) must not re-run focus/lock logic.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const overlay = dialog?.parentElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Everything behind the sheet becomes inert (no focus, no screen-reader access).
    const inerted = Array.from(document.body.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el !== overlay && !el.inert);
    inerted.forEach((el) => { el.inert = true; });
    dialog?.focus();

    const isTop = () => {
      const all = document.querySelectorAll('[role="dialog"]');
      return all[all.length - 1] === dialog;
    };
    function onKey(e: KeyboardEvent) {
      if (!isTop()) return; // a remark modal on top handles its own Esc/Tab
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    const mq = window.matchMedia("(min-width: 640px)");
    const onMq = () => { if (mq.matches) onCloseRef.current(); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      inerted.forEach((el) => { el.inert = false; });
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  // Pull-down from the content: when the scrolled body is at the very top, a downward swipe drags the whole
  // sheet (same dismiss rule as the handle). Native scrolling is untouched until that moment.
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    let startY = 0, startT = 0, scroller: HTMLElement | null = null, mode: "idle" | "pull" | "scroll" = "idle";
    const scrollParent = (el: EventTarget | null) => {
      let n = el as HTMLElement | null;
      while (n && n !== dialog) {
        if (n.scrollHeight > n.clientHeight && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n;
        n = n.parentElement;
      }
      return null;
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as Element).closest("[data-dot-popover],[data-dot-btn]")) { mode = "scroll"; return; }
      startY = e.touches[0].clientY; startT = e.timeStamp;
      scroller = scrollParent(e.target);
      mode = "idle";
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "scroll") return;
      const dy = e.touches[0].clientY - startY;
      if (mode === "idle") {
        if (Math.abs(dy) < 6) return;
        if (dy < 0 || (scroller && scroller.scrollTop > 0)) { mode = "scroll"; return; }
        mode = "pull";
      }
      e.preventDefault();
      y.set(Math.max(0, dy - 6));
    };
    const onEnd = (e: TouchEvent) => {
      if (mode !== "pull") return;
      mode = "idle";
      const dist = parseFloat(String(y.get())) || 0, vel = dist / Math.max(1, e.timeStamp - startT);
      if (dist > 100 || vel > 0.6) onCloseRef.current();
      else animate(y, 0, { duration: 0.2, ease: [0.22, 1, 0.36, 1] });
    };
    dialog.addEventListener("touchstart", onStart, { passive: true });
    dialog.addEventListener("touchmove", onMove, { passive: false });
    dialog.addEventListener("touchend", onEnd);
    dialog.addEventListener("touchcancel", onEnd);
    return () => {
      dialog.removeEventListener("touchstart", onStart);
      dialog.removeEventListener("touchmove", onMove);
      dialog.removeEventListener("touchend", onEnd);
      dialog.removeEventListener("touchcancel", onEnd);
    };
  }, [open, y]);

  if (!mounted) return null;
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
            style={{ y, paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={reduced ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduced ? undefined : { y: "100%" }}
            transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            // Drag starts only from the handle strip, so the content below keeps native vertical scrolling.
            drag={reduced ? false : "y"}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 600) onClose(); }}
          >
            <div
              className="flex h-7 shrink-0 cursor-grab touch-none items-start justify-center pt-2"
              aria-hidden="true"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={en ? "Close" : "Zatvori"}
              className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
