"use client";

import { useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { ResultsHistoryTable, type ResultRowData } from "./ResultsHistoryTable";
import { ResultsDateRangePicker } from "./ResultsDateRangePicker";
import type { ResultsCursor } from "@/lib/shooter-results";

type Props = {
  shooterId: number;
  initialResults: ResultRowData[];
  initialCursor: ResultsCursor | null;
  allLabel: string;
  loadMoreLabel: string;
  loadingLabel: string;
  searchPlaceholder: string;
  dateLabel: string;
  fromLabel: string;
  toLabel: string;
  applyDateLabel: string;
  dateDaysLabel: string;
  dateMonthsLabel: string;
  dateYearsLabel: string;
  clearDateLabel: string;
  emptyLabel: string;
  locale: string;
};

export function ShooterResultsArchive({ shooterId, initialResults, initialCursor, allLabel, loadMoreLabel, loadingLabel, searchPlaceholder, dateLabel, fromLabel: _fromLabel, toLabel: _toLabel, applyDateLabel, dateDaysLabel, dateMonthsLabel, dateYearsLabel, clearDateLabel, emptyLabel, locale }: Props) {
  const [results, setResults] = useState(initialResults);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  async function fetchPage(nextCursor?: ResultsCursor, nextQuery = appliedQuery, nextFrom = appliedFrom, nextTo = appliedTo) {
    const params = new URLSearchParams();
    if (nextCursor) { params.set("date", nextCursor.date); params.set("id", String(nextCursor.id)); }
    if (nextQuery) params.set("q", nextQuery);
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const response = await fetch(`/api/shooters/${shooterId}/results?${params}`);
    if (!response.ok) throw new Error("Failed to load results");
    return response.json() as Promise<{ results: ResultRowData[]; nextCursor: ResultsCursor | null }>;
  }

  async function applyFilters(nextQuery = query, nextFrom = from, nextTo = to) {
    setLoading(true);
    try {
      const page = await fetchPage(undefined, nextQuery, nextFrom, nextTo);
      setResults(page.results);
      setCursor(page.nextCursor);
      setAppliedQuery(nextQuery);
      setAppliedFrom(nextFrom);
      setAppliedTo(nextTo);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await fetchPage(cursor);
      setResults((current) => [...current, ...page.results]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  const toolbar = <form className="ml-auto flex min-w-0 shrink items-center gap-1 sm:gap-1.5" onSubmit={(event) => { event.preventDefault(); void applyFilters(); }}>
    <label className="relative min-w-0"><span className="sr-only">{searchPlaceholder}</span><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={searchPlaceholder} className="h-8 w-28 rounded bg-[var(--surface-2)] py-1 pl-8 pr-2 text-xs text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--brand-primary)] sm:w-40" /></label>
    <ResultsDateRangePicker value={{ from, to }} onApply={(range) => { setFrom(range.from); setTo(range.to); void applyFilters(query, range.from, range.to); }} locale={locale} labels={{ date: dateLabel, days: dateDaysLabel, months: dateMonthsLabel, years: dateYearsLabel, clear: clearDateLabel, apply: applyDateLabel }} />
  </form>;

  return <div className="space-y-4">
    <ResultsHistoryTable key={`${appliedQuery}:${appliedFrom}:${appliedTo}`} results={results} allLabel={allLabel} locale={locale} toolbar={toolbar} emptyContent={emptyLabel} />
    {cursor && <div className="flex justify-center">
      <button type="button" onClick={loadMore} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-wait disabled:opacity-60">
        {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
        {loading ? loadingLabel : loadMoreLabel}
      </button>
    </div>}
  </div>;
}
