"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

interface Props {
  page: number;
  total: number;
  pageSize: number;
}

export function Pagination({ page, total, pageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
      <span className="text-xs text-[var(--muted)]">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} od {total}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-30 transition-colors"
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1 text-xs text-[var(--subtle)]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p as number)}
              className="px-2.5 py-1 rounded text-xs font-semibold transition-colors"
              style={{
                background: p === page ? "var(--brand-primary)" : "transparent",
                color: p === page ? "white" : "var(--muted)",
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => go(page + 1)}
          disabled={page === totalPages}
          className="px-2 py-1 rounded text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-30 transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
}
