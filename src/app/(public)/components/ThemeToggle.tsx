"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = () => setIsDark(!isDark);

  return (
    <button
      onClick={toggle}
      className="rounded-md bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white transition-colors duration-150"
    >
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
