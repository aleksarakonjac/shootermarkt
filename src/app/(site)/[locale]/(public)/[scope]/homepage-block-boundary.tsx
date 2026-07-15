"use client";

import { Component, type ReactNode } from "react";

export class HomepageBlockBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">Sadržaj je trenutno nedostupan.</div>
      : this.props.children;
  }
}
