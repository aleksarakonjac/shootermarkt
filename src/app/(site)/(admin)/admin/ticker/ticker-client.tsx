"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { formatDateSr } from "@/lib/date-utils";
import { CATEGORY_LABEL, type AgeCategory } from "@/lib/pdf-import/types";
import { venueLocalToUtc } from "@/lib/timezone";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompetitionRow {
  id: number;
  name: string;
  date: string;
  dateEnd: string | null;
  location: string | null;
  level: string;
  countryCode2: string | null;
  nocCode: string | null;
  timezone: string;
}

interface SlotRow {
  id: number;
  competitionId: number;
  disciplineId: number;
  disciplineCode: string;
  disciplineName: string;
  stage: string;
  category: string;
  startTime: string;
  endTime: string | null;
}

interface DisciplineOption {
  id: number;
  code: string;
  name: string;
}

interface Override {
  id: number;
  type: string;
  competitionId: number | null;
  isActive: boolean;
  customSlides: Array<{ label?: string; text: string }> | null;
  priority: number;
  label: string | null;
  href: string | null;
  createdAt: string;
}

interface CustomUpcomingRow {
  id: number;
  text: string;
  date: string | null;
  href: string | null;
  displayUntil: string | null;
  createdAt: string;
}

interface ArticleOption {
  id: number;
  title: string;
  slug: string;
  publishedAt: string | null;
}

interface AutoTickerItem {
  id: number;
  name: string;
  detailItems: Array<{ label?: string; text: string; href?: string }>;
}

interface Props {
  competitions: CompetitionRow[];
  slots: SlotRow[];
  disciplines: DisciplineOption[];
  overrides: Override[];
  customUpcoming: CustomUpcomingRow[];
  liveSlotIds: number[];
  uskoroCompIds: number[];
  recentArticles: ArticleOption[];
  autoTickerItems: AutoTickerItem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────


const STAGE_OPTIONS = [
  { value: "qual",           label: "Kvalifikacije" },
  { value: "qual_precision", label: "Precizna paljba (SPW)" },
  { value: "qual_rapid",     label: "Brza paljba (SPW)" },
  { value: "elimination",    label: "Eliminacije (R3)" },
  { value: "final",          label: "Finale" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGE_OPTIONS.map((s) => [s.value, s.label])
);

const TYPE_LABEL: Record<string, string> = {
  live:   "Live",
  uskoro: "Uskoro",
  article: "Članak",
  custom: "Custom",
};

const TYPE_COLOR: Record<string, string> = {
  live:    "bg-[var(--brand-primary)] text-white",
  uskoro:  "bg-amber-500 text-white",
  article: "bg-sky-600 text-white",
  custom:  "bg-[var(--surface-2)] text-[var(--ink)]",
};

// ── CustomSelect ──────────────────────────────────────────────────────────────

function CustomSelect({
  value, onChange, options, placeholder = "Izaberi…", className, searchable,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sublabel?: string }[];
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}) {
  const [open, setOpen]     = useState(false);
  const [rect, setRect]     = useState<DOMRect | null>(null);
  const [search, setSearch] = useState("");
  const triggerRef          = useRef<HTMLButtonElement>(null);
  const panelRef            = useRef<HTMLDivElement>(null);
  const selected            = options.find((o) => o.value === value);

  const filtered = searchable && search
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : options;

  function openDropdown() {
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setSearch("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node) || panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function update() { setRect(triggerRef.current?.getBoundingClientRect() ?? null); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  const panelStyle: React.CSSProperties = rect
    ? { position: "fixed", top: rect.bottom + 4, left: rect.left, minWidth: rect.width, zIndex: 9999 }
    : { display: "none" };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className={`${inputCls} cursor-pointer flex items-center justify-between gap-2 ${className ?? ""}`}
      >
        <span className={selected ? "text-[var(--ink)]" : "text-[var(--subtle)]"}>
          {selected?.label ?? placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-[var(--muted)]" aria-hidden="true">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden"
        >
          {searchable && (
            <div className="p-1.5 border-b border-[var(--border)]">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pretraži…"
                className="w-full rounded px-2 py-1 text-xs text-[var(--ink)] bg-[var(--surface)] focus:outline-none placeholder:text-[var(--subtle)]"
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface)] transition-colors flex flex-col gap-0.5"
                style={{ fontWeight: o.value === value ? 700 : 400, color: o.value === value ? "var(--brand-primary)" : "var(--ink)" }}
              >
                <span>{o.label}</span>
                {o.sublabel && <span className="text-[0.65rem] text-[var(--subtle)] font-normal truncate">{o.sublabel}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--subtle)]">Nema rezultata</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string, timezone?: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, // undefined = browser's own timezone
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

function formatDateRange(start: string, end: string | null): string {
  const [sy, sm, sd] = start.split("-");
  if (!end || end === start) return `${sd}.${sm}.${sy}.`;
  const [ey, em, ed] = end.split("-");
  if (sm === em && sy === ey) return `${sd}–${ed}.${sm}.${sy}.`;
  return `${sd}.${sm}–${ed}.${em}.${sy}.`;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const btn        = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors";
const btnPrimary = `${btn} bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]`;
const btnGhost   = `${btn} text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]`;
const btnDanger  = `${btn} text-[var(--brand-primary)] hover:bg-red-50 dark:hover:bg-red-950`;
const inputCls   = "block w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors";

function LiveDot() {
  return (
    <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] shrink-0" style={{ animation: "ticker-pulse 1.4s ease-in-out infinite" }} />
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide shrink-0 ${TYPE_COLOR[type] ?? TYPE_COLOR.custom}`}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TickerAdminClient({
  competitions,
  slots,
  disciplines,
  overrides,
  customUpcoming,
  liveSlotIds,
  uskoroCompIds,
  recentArticles,
  autoTickerItems,
}: Props) {
  const router                  = useRouter();
  const [, startTransition]     = useTransition();
  const refresh                 = () => startTransition(() => router.refresh());

  const activeOverrides  = overrides.filter((o) => o.isActive);
  const linkedItems      = overrides.filter((o) => o.type === "linked");
  const forcedOverrides  = overrides.filter((o) => o.type !== "linked");
  const isAnythingLive   = autoTickerItems.length > 0 || activeOverrides.some(o => o.type === "live" || o.type === "uskoro" || o.type === "article" || o.type === "custom");

  // Auto-detected uskoro comps (from server)
  const uskoroAutoComps  = competitions.filter(c => uskoroCompIds.includes(c.id));

  const addLinkedItem = async (competitionId: number, payload: { label: string; href: string | null; customSlides: Array<{ text: string }> }) => {
    await fetch("/api/admin/ticker/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, competitionId, type: "linked" }),
    });
    refresh();
  };
  const toggleLinkedItem = async (item: Override) => {
    await fetch(`/api/admin/ticker/override/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    refresh();
  };
  const deleteLinkedItem = async (item: Override) => {
    await fetch(`/api/admin/ticker/override/${item.id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="space-y-10">

      {/* ── Section 1: Live status ────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Live ticker (gornji)"
          subtitle="Šta se trenutno prikazuje u gornjem ticker traku"
          live={isAnythingLive}
        />

        <AutoTickerPreview
          items={autoTickerItems}
          linkedItems={linkedItems}
          articles={recentArticles}
          onAdd={addLinkedItem}
          onToggle={toggleLinkedItem}
          onDelete={deleteLinkedItem}
        />

        {/* All upper ticker overrides (live, uskoro, article, custom) */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink)]">Forsiran sadržaj gornjeg tickera</span>
            <span className="text-xs text-[var(--muted)]">{forcedOverrides.filter((override) => override.isActive).length} aktivnih</span>
          </div>

          {forcedOverrides.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--subtle)]">
              Nema forsiranog sadržaja. Dodaj ispod ili koristi &ldquo;Forsirati live/uskoro&rdquo; na takmičenju.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {forcedOverrides.map((o) => {
                const comp = competitions.find((c) => c.id === o.competitionId);
                return (
                  <OverrideRow
                    key={o.id}
                    override={o}
                    compName={comp?.name ?? o.label ?? `Override #${o.id}`}
                    onToggle={async () => {
                      await fetch(`/api/admin/ticker/override/${o.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: !o.isActive }),
                      });
                      refresh();
                    }}
                    onDelete={async () => {
                      await fetch(`/api/admin/ticker/override/${o.id}`, { method: "DELETE" });
                      refresh();
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Add article or custom text to upper ticker */}
          <AddUpperTickerForm
            articles={recentArticles}
            onAdd={async (payload) => {
              await fetch("/api/admin/ticker/override", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              refresh();
            }}
          />
        </div>

        {!isAnythingLive && uskoroAutoComps.length === 0 && (
          <p className="mt-3 text-xs text-[var(--muted)] text-center">
            Gornji ticker je skriven. Dodaj satnice, forsir live/uskoro, ili dodaj custom sadržaj.
          </p>
        )}
      </section>

      {/* ── Section 2: Competition schedule ──────────────────────────────── */}
      <section>
        <SectionHeader
          title="Satnica takmičenja"
          subtitle="Discipline, faze i vremena — osnova auto live/uskoro detekcije"
        />

        {competitions.length === 0 ? (
          <EmptyState text="Nema takmičenja u narednih 30 dana." />
        ) : (
          <div className="rounded-lg border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            {competitions.map((comp) => {
              const compSlots     = slots.filter((s) => s.competitionId === comp.id);
              const liveOverride  = overrides.find((o) => o.competitionId === comp.id && o.isActive && o.type === "live");
              const uskoroOverride = overrides.find((o) => o.competitionId === comp.id && o.isActive && o.type === "uskoro");
              const hasLiveSlot   = compSlots.some((s) => liveSlotIds.includes(s.id));
              const isAutoUskoro  = uskoroCompIds.includes(comp.id);

              return (
                <CompetitionScheduleRow
                  key={comp.id}
                  comp={comp}
                  slots={compSlots}
                  disciplines={disciplines}
                  liveSlotIds={liveSlotIds}
                  activeLiveOverride={liveOverride ?? null}
                  activeUskoroOverride={uskoroOverride ?? null}
                  isLive={hasLiveSlot}
                  isAutoUskoro={isAutoUskoro}
                  onSlotAdd={async (payload) => {
                    const res = await fetch("/api/admin/ticker/schedule", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...payload, competitionId: comp.id }),
                    });
                    if (!res.ok) { const err = await res.json(); return err.error as string; }
                    refresh();
                    return null;
                  }}
                  onSlotDelete={async (slotId) => {
                    await fetch(`/api/admin/ticker/schedule/${slotId}`, { method: "DELETE" });
                    refresh();
                  }}
                  onForceToggle={async (type) => {
                    const existing = type === "live" ? liveOverride : uskoroOverride;
                    if (existing) {
                      await fetch(`/api/admin/ticker/override/${existing.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: false }),
                      });
                    } else {
                      await fetch("/api/admin/ticker/override", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ competitionId: comp.id, type }),
                      });
                    }
                    refresh();
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Custom upcoming (bottom bar) ───────────────────────── */}
      <section>
        <SectionHeader
          title="Custom najave (donji ticker)"
          subtitle="Ručne stavke u donjem traku pored automatskih iz baze"
        />

        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          {customUpcoming.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {customUpcoming.map((entry) => (
                <CustomUpcomingEntryRow
                  key={entry.id}
                  entry={entry}
                  onDelete={async () => {
                    await fetch(`/api/admin/ticker/custom-upcoming/${entry.id}`, { method: "DELETE" });
                    refresh();
                  }}
                />
              ))}
            </div>
          )}

          <AddCustomUpcomingForm
            onAdd={async (payload) => {
              await fetch("/api/admin/ticker/custom-upcoming", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              refresh();
            }}
          />
        </div>
      </section>

    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function AutoTickerPreview({ items, linkedItems, articles, onAdd, onToggle, onDelete }: {
  items: AutoTickerItem[];
  linkedItems: Override[];
  articles: ArticleOption[];
  onAdd: (competitionId: number, payload: { label: string; href: string | null; customSlides: Array<{ text: string }> }) => Promise<void>;
  onToggle: (item: Override) => Promise<void>;
  onDelete: (item: Override) => Promise<void>;
}) {
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-xs font-semibold text-[var(--ink)]">Automatski prikaz</span>
        <span className="text-xs text-[var(--muted)]">Tačna rotacija gornjeg tickera</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs text-[var(--subtle)]">Trenutno nema automatskog sadržaja u gornjem tickeru.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <div key={item.id}>
              <div className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--ink)]">
                <LiveDot />
                <span className="truncate">{item.name}</span>
              </div>
              <div className="space-y-1.5 pl-4">
                {item.detailItems.length ? item.detailItems.map((detail, index) => (
                  <div key={`${detail.label ?? "auto"}-${index}`} className="flex items-baseline gap-2 text-xs">
                    <span className="w-16 shrink-0 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">{detail.label ?? "AUTO"}</span>
                    <span className="min-w-0 text-[var(--ink)]">{detail.text}</span>
                    {detail.href && <span className="shrink-0 text-[var(--subtle)]">↗</span>}
                  </div>
                )) : (
                  <p className="text-xs text-[var(--muted)]">U toku</p>
                )}
              </div>
              </div>
              <LinkedTickerItems
                items={linkedItems.filter((linkedItem) => linkedItem.competitionId === item.id)}
                articles={articles}
                onAdd={(payload) => onAdd(item.id, payload)}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedTickerItems({ items, articles, onAdd, onToggle, onDelete }: {
  items: Override[];
  articles: ArticleOption[];
  onAdd: (payload: { label: string; href: string | null; customSlides: Array<{ text: string }> }) => Promise<void>;
  onToggle: (item: Override) => Promise<void>;
  onDelete: (item: Override) => Promise<void>;
}) {
  const [type, setType] = useState<"article" | "custom">("custom");
  const [articleSlug, setArticleSlug] = useState("");
  const [text, setText] = useState("");
  const [href, setHref] = useState("");
  const [loading, setLoading] = useState(false);
  const articleOptions = articles.map((article) => ({
    value: article.slug,
    label: article.title,
    sublabel: article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" }) : undefined,
  }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const title = text.trim() || (type === "article" ? articles.find((article) => article.slug === articleSlug)?.title : "");
    if (!title) return;
    setLoading(true);
    await onAdd({
      label: type === "article" ? "VEST" : "INFO",
      href: type === "article" ? `/vesti/${articleSlug}` : (href.trim() || null),
      customSlides: [{ text: title }],
    });
    setLoading(false);
    setArticleSlug(""); setText(""); setHref("");
  }

  return (
    <div className="border-t border-[var(--border)]">
      <div className="px-6 py-3">
        <p className="text-xs font-semibold text-[var(--ink)]">Vezane stavke u automatskoj rotaciji</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Prikazuju se samo dok je ovo takmičenje automatski aktivno u gornjem tickeru.</p>
      </div>
      {items.length > 0 && (
        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-6 py-2.5 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${item.isActive ? "bg-[var(--brand-primary)]" : "bg-[var(--border-strong)]"}`} />
              <span className="w-12 shrink-0 font-mono text-[0.65rem] font-bold text-[var(--muted)]">{item.label ?? "INFO"}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{item.customSlides?.[0]?.text ?? item.label}</span>
              <button type="button" onClick={() => onToggle(item)} className={btnGhost}>{item.isActive ? "Pauziraj" : "Aktiviraj"}</button>
              <button type="button" onClick={() => onDelete(item)} className={btnDanger}>Ukloni</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-dashed border-[var(--border)] px-6 py-3">
        <div className="flex w-32 flex-col gap-1">
          <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Tip</label>
          <CustomSelect value={type} onChange={(value) => setType(value as "article" | "custom")} options={[{ value: "custom", label: "Custom tekst" }, { value: "article", label: "Članak / vest" }]} />
        </div>
        {type === "article" ? (
          <>
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Članak</label>
              <CustomSelect value={articleSlug} onChange={(slug) => { setArticleSlug(slug); setText(articles.find((article) => article.slug === slug)?.title ?? ""); }} options={articleOptions} placeholder="Pretraži sve članke…" searchable />
            </div>
            <div className="flex min-w-[180px] flex-1 flex-col gap-1">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Naslov u tickeru</label>
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Preuzima se naslov članka" className={inputCls} />
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-[180px] flex-1 flex-col gap-1">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Tekst</label>
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder="npr. Eliminacije počinju u 14 h" className={inputCls} />
            </div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Link (opciono)</label>
              <input value={href} onChange={(event) => setHref(event.target.value)} placeholder="/vesti/..." className={inputCls} />
            </div>
          </>
        )}
        <button type="submit" disabled={loading || (type === "article" ? !articleSlug : !text.trim())} className={`${btnPrimary} self-end disabled:opacity-40`}>Dodaj u rotaciju</button>
      </form>
    </div>
  );
}

function SectionHeader({ title, subtitle, live }: { title: string; subtitle: string; live?: boolean }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
        {title}
        {live && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide bg-[var(--brand-primary)] text-white">
            <LiveDot /> Live
          </span>
        )}
      </h2>
      <p className="text-xs text-[var(--muted)]">{subtitle}</p>
    </div>
  );
}

// ── OverrideRow ───────────────────────────────────────────────────────────────

function OverrideRow({ override, compName, onToggle, onDelete }: {
  override: Override;
  compName: string;
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full shrink-0 ${override.isActive ? "bg-[var(--brand-primary)]" : "bg-[var(--border-strong)]"}`} />
      <TypeBadge type={override.type} />
      <span className="flex-1 text-xs font-medium text-[var(--ink)] truncate">{compName}</span>
      {override.href && (
        <span className="text-[0.65rem] text-[var(--subtle)] truncate max-w-[120px] shrink-0">{override.href}</span>
      )}
      <span className={`text-xs font-semibold shrink-0 ${override.isActive ? "text-[var(--brand-primary)]" : "text-[var(--muted)]"}`}>
        {override.isActive ? "Aktivno" : "Neaktivno"}
      </span>
      <button onClick={async () => { setLoading(true); await onToggle(); setLoading(false); }} disabled={loading} className={btnGhost}>
        {override.isActive ? "Pauziraj" : "Aktiviraj"}
      </button>
      <button onClick={async () => { setLoading(true); await onDelete(); setLoading(false); }} disabled={loading} className={btnDanger}>
        Ukloni
      </button>
    </div>
  );
}

// ── AddUpperTickerForm ────────────────────────────────────────────────────────

function AddUpperTickerForm({ articles, onAdd }: {
  articles: ArticleOption[];
  onAdd: (p: { type: string; label: string; href: string | null; customSlides: Array<{ text: string }> | null }) => Promise<void>;
}) {
  const [type, setType]           = useState<"article" | "custom">("custom");
  const [label, setLabel]         = useState("");
  const [href, setHref]           = useState("");
  const [text, setText]           = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [loading, setLoading]     = useState(false);

  const articleOptions = articles.map((a) => ({
    value: a.slug,
    label: a.title,
    sublabel: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" }) : undefined,
  }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    if (type === "article" && !articleSlug) return;
    setLoading(true);
    await onAdd({
      type,
      label: label.trim(),
      href:  type === "article" ? `/vesti/${articleSlug}` : (href.trim() || null),
      customSlides: type === "custom" && text.trim() ? [{ text: text.trim() }] : null,
    });
    setLoading(false);
    setLabel(""); setHref(""); setText(""); setArticleSlug("");
  }

  const canSubmit = label.trim() && (type === "custom" || articleSlug);

  return (
    <form onSubmit={submit} className="px-4 py-3 border-t border-dashed border-[var(--border)] flex flex-wrap items-end gap-3 bg-[var(--surface)]">
      <div className="flex flex-col gap-1 w-32">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Tip</label>
        <CustomSelect
          value={type}
          onChange={(v) => { setType(v as "article" | "custom"); setArticleSlug(""); }}
          options={[{ value: "custom", label: "Custom tekst" }, { value: "article", label: "Članak / vest" }]}
        />
      </div>

      {type === "article" && (
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Izaberi članak</label>
          <CustomSelect
            value={articleSlug}
            onChange={(slug) => {
              setArticleSlug(slug);
              if (!label.trim()) {
                const picked = articles.find((a) => a.slug === slug);
                if (picked) setLabel(picked.title);
              }
            }}
            options={articleOptions}
            placeholder="Pretraži članke…"
            searchable
          />
        </div>
      )}

      <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">
          {type === "article" ? "Label u tickeru (može biti kraći od naslova)" : "Label (kratak)"}
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={type === "article" ? "npr. Petrović pobedio na SP" : "npr. Obaveštenje"}
          className={inputCls}
          required
        />
      </div>

      {type === "custom" && (
        <>
          <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Tekst / opis (opciono)</label>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Detalji koji se prikazuju..." className={inputCls} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
            <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Link (opciono)</label>
            <input type="text" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/takmicenja/123" className={inputCls} />
          </div>
        </>
      )}

      <button type="submit" disabled={!canSubmit || loading} className={`${btnPrimary} disabled:opacity-40 self-end`}>
        + Dodaj u ticker
      </button>
    </form>
  );
}

// ── CompetitionScheduleRow ────────────────────────────────────────────────────

function CompetitionScheduleRow({
  comp, slots, disciplines, liveSlotIds,
  activeLiveOverride, activeUskoroOverride,
  isLive, isAutoUskoro,
  onSlotAdd, onSlotDelete, onForceToggle,
}: {
  comp: CompetitionRow;
  slots: SlotRow[];
  disciplines: DisciplineOption[];
  liveSlotIds: number[];
  activeLiveOverride: Override | null;
  activeUskoroOverride: Override | null;
  isLive: boolean;
  isAutoUskoro: boolean;
  onSlotAdd: (p: { disciplineId: number; stage: string; category: string; startTime: string; endTime: string | null }) => Promise<string | null>;
  onSlotDelete: (slotId: number) => Promise<void>;
  onForceToggle: (type: "live" | "uskoro") => Promise<void>;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [forceLoading, setForceLoading] = useState<"live" | "uskoro" | null>(null);

  const levelStyle = LEVEL_STYLE[comp.level] ?? { background: "var(--surface-2)", color: "var(--muted)" };
  const showLiveDot = isLive || activeLiveOverride?.isActive;

  return (
    <div>
      <div className="px-4 py-3 flex items-center gap-3 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[var(--muted)] shrink-0 transition-transform duration-150"
          style={{ transform: expanded ? "rotate(90deg)" : undefined }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showLiveDot && <LiveDot />}
        {!showLiveDot && isAutoUskoro && (
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left text-sm font-medium text-[var(--ink)] truncate hover:text-[var(--brand-primary)] transition-colors"
        >
          {comp.name}
        </button>

        <span className="text-xs text-[var(--muted)] shrink-0 hidden sm:block">
          {formatDateRange(comp.date, comp.dateEnd)}
        </span>

        <span
          className="shrink-0 hidden sm:inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide"
          style={{ background: levelStyle.background, color: levelStyle.color }}
        >
          {LEVEL_LABEL[comp.level] ?? comp.level}
        </span>

        <span className="text-xs text-[var(--subtle)] shrink-0 w-14 text-right">
          {slots.length} {slots.length === 1 ? "slot" : "slotova"}
        </span>

        {/* Force uskoro */}
        <button
          onClick={async () => { setForceLoading("uskoro"); await onForceToggle("uskoro"); setForceLoading(null); }}
          disabled={forceLoading !== null}
          className={activeUskoroOverride?.isActive ? `${btnGhost} text-amber-600` : btnGhost}
          title="Forsirati USKORO prikaz"
        >
          {activeUskoroOverride?.isActive ? "▲ Uskoro" : "Forsirati uskoro"}
        </button>

        {/* Force live */}
        <button
          onClick={async () => { setForceLoading("live"); await onForceToggle("live"); setForceLoading(null); }}
          disabled={forceLoading !== null}
          className={activeLiveOverride?.isActive ? btnDanger : btnGhost}
        >
          {activeLiveOverride?.isActive ? (
            <><span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] inline-block" /> Forsirano live</>
          ) : "Forsirati live"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)]">
          {slots.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {slots
                .slice()
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    timezone={comp.timezone}
                    live={liveSlotIds.includes(slot.id)}
                    onDelete={() => onSlotDelete(slot.id)}
                  />
                ))}
            </div>
          )}
          <AddSlotForm
            disciplines={disciplines}
            compDateStart={comp.date}
            compDateEnd={comp.dateEnd ?? comp.date}
            timezone={comp.timezone}
            onAdd={onSlotAdd}
          />
        </div>
      )}
    </div>
  );
}

// ── SlotRow ───────────────────────────────────────────────────────────────────

function SlotRow({ slot, timezone, live, onDelete }: { slot: SlotRow; timezone: string; live: boolean; onDelete: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className={`px-6 py-2.5 flex items-center gap-4 text-xs ${live ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
      {live && <LiveDot />}
      <span className="font-mono font-bold text-[var(--brand-primary)] w-10 shrink-0">{slot.disciplineCode}</span>
      <span className="w-40 shrink-0 text-[var(--ink)] font-medium">{STAGE_LABEL[slot.stage] ?? slot.stage}</span>
      <span className="px-2 py-0.5 rounded text-[0.65rem] font-medium bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)] uppercase shrink-0">
        {CATEGORY_LABEL[slot.category as AgeCategory] ?? slot.category}
      </span>
      <span className="text-[var(--muted)] shrink-0 flex flex-col leading-tight">
        <span>{fmtDatetime(slot.startTime, timezone)}</span>
        <span className="text-[0.65rem] text-[var(--subtle)]">({fmtDatetime(slot.startTime)} tvoje vreme)</span>
      </span>
      {slot.endTime && (
        <>
          <span className="text-[var(--border-strong)]">→</span>
          <span className="text-[var(--muted)] shrink-0 flex flex-col leading-tight">
            <span>{fmtDatetime(slot.endTime, timezone)}</span>
            <span className="text-[0.65rem] text-[var(--subtle)]">({fmtDatetime(slot.endTime)} tvoje vreme)</span>
          </span>
        </>
      )}
      <span className="flex-1" />
      <button
        onClick={async () => { setLoading(true); await onDelete(); setLoading(false); }}
        disabled={loading || live}
        title={live ? "Ne može se brisati dok je aktivan" : "Obriši slot"}
        className={`${btnDanger} disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        Obriši
      </button>
    </div>
  );
}

// ── AddSlotForm ───────────────────────────────────────────────────────────────

const TICKER_DISCIPLINE_CODES = new Set(["ARM", "ARW", "APM", "APW", "ARMT", "APMT", "R3PM", "R3PW", "SPW"]);

function AddSlotForm({ disciplines, compDateStart, compDateEnd, timezone, onAdd }: {
  disciplines: DisciplineOption[];
  compDateStart: string;
  compDateEnd: string;
  timezone: string;
  onAdd: (p: { disciplineId: number; stage: string; category: string; startTime: string; endTime: string | null }) => Promise<string | null>;
}) {
  const [disciplineId, setDisciplineId] = useState("");
  const [stage, setStage]               = useState("");
  const [category, setCategory]         = useState("senior");
  const [startTime, setStartTime]       = useState("");
  const [endTime, setEndTime]           = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);

  const valid = disciplineId && stage && category && startTime;

  function toUtcIso(localValue: string): string {
    const [datePart, timePart] = localValue.split("T");
    return venueLocalToUtc(datePart, timePart, timezone).toISOString();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true); setError(null);
    const err = await onAdd({
      disciplineId: parseInt(disciplineId),
      stage,
      category,
      startTime: toUtcIso(startTime),
      endTime: endTime ? toUtcIso(endTime) : null,
    });
    setLoading(false);
    if (err) { setError(err); return; }
    setDisciplineId(""); setStage(""); setCategory("senior"); setStartTime(""); setEndTime("");
  }

  return (
    <form onSubmit={submit} className="px-6 py-3 flex flex-wrap items-end gap-3 border-t border-dashed border-[var(--border)]">
      <div className="flex flex-col gap-1 w-36">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Disciplina</label>
        <CustomSelect
          value={disciplineId}
          onChange={setDisciplineId}
          options={disciplines.filter((d) => TICKER_DISCIPLINE_CODES.has(d.code)).map((d) => ({ value: String(d.id), label: d.code }))}
        />
      </div>
      <div className="flex flex-col gap-1 w-44">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Faza</label>
        <CustomSelect
          value={stage}
          onChange={setStage}
          options={STAGE_OPTIONS}
        />
      </div>
      <div className="flex flex-col gap-1 w-40">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Kategorija</label>
        <CustomSelect
          value={category}
          onChange={setCategory}
          options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Početak (vreme na lokaciji, {timezone})</label>
        <DateTimePicker
          value={startTime}
          onChange={setStartTime}
          min={`${compDateStart}T00:00`}
          max={`${compDateEnd}T23:59`}
          placeholder="Izaberi…"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Kraj (opciono, vreme na lokaciji)</label>
        <DateTimePicker
          value={endTime}
          onChange={setEndTime}
          min={startTime || `${compDateStart}T00:00`}
          max={`${compDateEnd}T23:59`}
          placeholder="Izaberi…"
        />
      </div>
      <button type="submit" disabled={!valid || loading} className={`${btnPrimary} disabled:opacity-40 self-end`}>+ Dodaj slot</button>
      {error && <p className="w-full text-xs text-[var(--brand-primary)] mt-1">{error}</p>}
    </form>
  );
}

// ── CustomUpcomingEntryRow ────────────────────────────────────────────────────

function CustomUpcomingEntryRow({ entry, onDelete }: { entry: CustomUpcomingRow; onDelete: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="px-4 py-3 flex items-center gap-4 text-xs">
      {entry.date && <span className="font-mono text-[var(--muted)] shrink-0 w-22">{formatDateSr(entry.date)}</span>}
      <span className="flex-1 font-medium text-[var(--ink)] truncate">{entry.text}</span>
      {entry.href && <span className="text-[var(--subtle)] truncate max-w-[140px] shrink-0">{entry.href}</span>}
      {entry.displayUntil && <span className="text-[var(--subtle)] shrink-0">do {formatDateSr(entry.displayUntil)}</span>}
      <button onClick={async () => { setLoading(true); await onDelete(); setLoading(false); }} disabled={loading} className={btnDanger}>Ukloni</button>
    </div>
  );
}

// ── AddCustomUpcomingForm ─────────────────────────────────────────────────────

function AddCustomUpcomingForm({ onAdd }: {
  onAdd: (p: { text: string; date: string | null; href: string | null; displayUntil: string | null }) => Promise<void>;
}) {
  const [text, setText]               = useState("");
  const [date, setDate]               = useState("");
  const [href, setHref]               = useState("");
  const [displayUntil, setDisplayUntil] = useState("");
  const [loading, setLoading]         = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    await onAdd({ text: text.trim(), date: date || null, href: href || null, displayUntil: displayUntil || null });
    setLoading(false);
    setText(""); setDate(""); setHref(""); setDisplayUntil("");
  }

  return (
    <form onSubmit={submit} className="px-4 py-3 flex flex-wrap items-end gap-3 bg-[var(--surface)]">
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Tekst najave</label>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="npr. Kup Srbije — Vazdušni Pištolj" className={inputCls} required />
      </div>
      <div className="flex flex-col gap-1 w-36">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Datum</label>
        <DatePicker value={date} onChange={setDate} placeholder="Izaberi..." size="xs" />
      </div>
      <div className="flex flex-col gap-1 w-40">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Link (opciono)</label>
        <input type="url" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/takmicenja/123" className={inputCls} />
      </div>
      <div className="flex flex-col gap-1 w-36">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Prikazuj do</label>
        <DatePicker value={displayUntil} onChange={setDisplayUntil} placeholder="Izaberi..." size="xs" />
      </div>
      <button type="submit" disabled={!text.trim() || loading} className={`${btnPrimary} disabled:opacity-40 self-end`}>+ Dodaj</button>
    </form>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
