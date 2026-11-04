"use client";

import { useEffect, useRef, useState } from "react";

const FLASH_MS = 2200;

/**
 * Id-jevi redova čiji se sadržaj promenio između dva render-a (novi rezultat stigao uživo).
 * Prvo učitavanje i promena prikaza (druga faza/disciplina, bez zajedničkih redova) ne trepere.
 * `rows`: [id, potpis sadržaja]; red trepće kad mu se potpis promeni ili se pojavi među postojećim.
 */
export function useRowFlash(rows: ReadonlyArray<readonly [number, string]>): ReadonlySet<number> {
  const key = rows.map(([id, signature]) => `${id}:${signature}`).join("|");
  const previous = useRef<Map<number, string> | null>(null);
  const timer = useRef<number | null>(null);
  const [flashing, setFlashing] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    const current = new Map(rows);
    const before = previous.current;
    previous.current = current;
    if (!before) return;
    let shared = 0;
    for (const id of current.keys()) if (before.has(id)) shared++;
    if (shared === 0) return;
    const changed = new Set<number>();
    for (const [id, signature] of current) if (before.get(id) !== signature) changed.add(id);
    if (changed.size === 0) return;
    if (timer.current != null) window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlashing(changed);
    timer.current = window.setTimeout(() => setFlashing(new Set()), FLASH_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);

  return flashing;
}
