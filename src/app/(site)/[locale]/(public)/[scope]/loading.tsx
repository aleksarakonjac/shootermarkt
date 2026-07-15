"use client";

import { QuickH2HClient } from "./quick-h2h-client";
import { CalendarModule } from "../components/CalendarModule";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <div className="h-10 animate-pulse rounded-xl bg-[var(--surface)]" />
          <div className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />
          <div className="h-64 animate-pulse rounded-xl bg-[var(--surface)]" />
        </div>
        <div className="flex flex-col gap-8">
          <CalendarModule competitions={[]} />
          <QuickH2HClient />
        </div>
      </div>
    </div>
  );
}
