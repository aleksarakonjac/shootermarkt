"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(localStorage.getItem("theme") === "dark");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark, mounted]);

  return (
    <button
      onClick={() => setIsDark((v) => !v)}
      aria-label={isDark ? "Prebaci na svetli mod" : "Prebaci na tamni mod"}
      className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-150"
    >
      {mounted && isDark ? (
        /* Sun icon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75"/>
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
