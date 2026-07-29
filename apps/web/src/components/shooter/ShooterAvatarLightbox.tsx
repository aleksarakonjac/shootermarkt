"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";

type Props = {
  src: string;
  alt: string;
};

export function ShooterAvatarLightbox({ src, alt }: Props) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-[var(--border)] transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] sm:h-28 sm:w-28"
        aria-label={`Otvori fotografiju: ${alt}`}
      >
        <Image src={src} alt={alt} fill sizes="(min-width: 640px) 112px, 96px" className="object-cover" />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
              role="dialog"
              aria-modal="true"
              aria-label={alt}
            >
              <motion.div
                className="pointer-events-none relative h-[min(82vh,56rem)] w-[min(92vw,56rem)]"
                initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
                transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <Image src={src} alt={alt} fill sizes="92vw" className="pointer-events-auto object-contain" />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="pointer-events-auto absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  aria-label="Zatvori fotografiju"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
