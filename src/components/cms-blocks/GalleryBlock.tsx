"use client";

import Image from "next/image";
import { useState } from "react";

interface MediaDoc {
  id: number;
  url: string;
  alt: string;
}

function gridClass(count: number): string {
  if (count === 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-2 sm:grid-cols-3";
}

function aspectClass(count: number, index: number): string {
  if (count === 1) return "aspect-[16/9]";
  if (count === 2) return "aspect-[4/3]";
  // First image of 3+ gets portrait slot to break the grid monotony
  if (index === 0 && count >= 3) return "aspect-[3/4]";
  return "aspect-square";
}

export function GalleryBlock({ images }: { images: MediaDoc[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!images.length) return null;

  const current = lightbox !== null ? images[lightbox] : null;

  return (
    <>
      <div className={`grid ${gridClass(images.length)} gap-2 my-6`}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightbox(i)}
            className={`relative ${aspectClass(images.length, i)} rounded-lg overflow-hidden bg-[var(--surface-2)] group focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2`}
            aria-label={`Otvori sliku: ${img.alt || `Slika ${i + 1}`}`}
          >
            <Image
              src={img.url}
              alt={img.alt || ""}
              fill
              sizes="(min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {current && lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.alt || "Slika"}
          className="fixed inset-0 z-[var(--z-modal-bd)] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* Prev */}
          {lightbox > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Prethodna"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <div
            className="relative max-w-4xl max-h-[85vh] w-full aspect-[4/3]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={current.url}
              alt={current.alt || ""}
              fill
              sizes="90vw"
              className="object-contain rounded-lg"
            />
            {current.alt && (
              <p className="mt-2 text-center text-sm text-white/60">{current.alt}</p>
            )}
          </div>

          {/* Next */}
          {lightbox < images.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Sledeća"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Zatvori"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-white/50 tabular-nums">
            {lightbox + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
