"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";

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
}

interface SlotRow {
  id: number;
  competitionId: number;
  disciplineId: number;
  disciplineCode: string;
  disciplineName: string;
  stage: string;
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
  competitionId: number | null;
  isActive: boolean;
  customSlides: Array<{ label?: string; text: string }> | null;
  priority: number;
  label: string | null;
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

interface Props {
  competitions: CompetitionRow[];
  slots: SlotRow[];
  disciplines: DisciplineOption[];
  overrides: Override[];
  customUpcoming: CustomUpcomingRow[];
  liveSlotIds: number[];
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string): string {
  // Treat as local time — show raw YYYY-MM-DDTHH:mm parts
  const d = iso.slice(0, 16); // "2026-07-05T09:00"
  const [date, time] = d.split("T");
  const [y, m, day] = date.split("-");
  return `${day}.${m}.${y} ${time}`;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function formatDateRange(start: string, end: string | null): string {
  const [sy, sm, sd] = start.split("-");
  if (!end || end === start) return `${sd}.${sm}.${sy}.`;
  const [ey, em, ed] = end.split("-");
  if (sm === em && sy === ey) return `${sd}–${ed}.${sm}.${sy}.`;
  return `${sd}.${sm}–${ed}.${em}.${sy}.`;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors";
const btnPrimary = `${btn} bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]`;
const btnGhost = `${btn} text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]`;
const btnDanger = `${btn} text-[var(--brand-primary)] hover:bg-red-50 dark:hover:bg-red-950`;
const inputCls = "block w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

// ── Live status dot ───────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span
      className="w-2 h-2 rounded-full bg-[var(--brand-primary)] shrink-0"
      style={{ animation: "ticker-pulse 1.4s ease-in-out infinite" }}
    />
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
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  const liveSlots = slots.filter((s) => liveSlotIds.includes(s.id));
  const activeOverrides = overrides.filter((o) => o.isActive);

  const isAnythingLive = liveSlots.length > 0 || activeOverrides.length > 0;

  return (
    <div className="space-y-10">

      {/* ── Section 1: Live status ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Live ticker"
          subtitle="Šta se trenutno prikazuje u gornjem tickeru"
          live={isAnythingLive}
        />

        {/* Auto-detected live from schedule */}
        {liveSlots.length > 0 && (
          <div className="mb-4 rounded-lg border border-[var(--brand-primary)] bg-red-50 dark:bg-red-950/20 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)] mb-3 flex items-center gap-2">
              <LiveDot /> Automatski detektovano (iz satnice)
            </p>
            <div className="space-y-1.5">
              {liveSlots.map((s) => {
                const comp = competitions.find((c) => c.id === s.competitionId);
                return (
                  <div key={s.id} className="flex items-center gap-3 text-xs text-[var(--ink)]">
                    <span className="font-mono font-bold text-[var(--brand-primary)] w-12 shrink-0">{s.disciplineCode}</span>
                    <span className="font-medium">{STAGE_LABEL[s.stage] ?? s.stage}</span>
                    <span className="text-[var(--muted)]">·</span>
                    <span className="truncate">{comp?.name ?? `Takmičenje #${s.competitionId}`}</span>
                    <span className="text-[var(--subtle)] shrink-0">{fmtDatetime(s.startTime)}
                      {s.endTime && ` → ${fmtDatetime(s.endTime)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin overrides */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink)]">Forsirana aktivacija</span>
            <span className="text-xs text-[var(--muted)]">{activeOverrides.length} aktivnih</span>
          </div>

          {overrides.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--subtle)]">
              Nema forsiranih aktivacija. Koristite "Forsirati live" na takmičenju ispod.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {overrides.map((o) => {
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
        </div>

        {!isAnythingLive && (
          <p className="mt-3 text-xs text-[var(--muted)] text-center">
            Gornji ticker je trenutno skriven. Dodaj satnice ili forsir aktivaciju da se pojavi.
          </p>
        )}
      </section>

      {/* ── Section 2: Competition schedule ────────────────────────────── */}
      <section>
        <SectionHeader
          title="Satnica takmičenja"
          subtitle="Kada počinju i završavaju se discipline — osnova auto live detekcije"
        />

        {competitions.length === 0 ? (
          <EmptyState text="Nema takmičenja u narednih 30 dana." />
        ) : (
          <div className="rounded-lg border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            {competitions.map((comp) => {
              const compSlots = slots.filter((s) => s.competitionId === comp.id);
              const activeOverride = overrides.find((o) => o.competitionId === comp.id && o.isActive);
              const hasLiveSlot = compSlots.some((s) => liveSlotIds.includes(s.id));

              return (
                <CompetitionScheduleRow
                  key={comp.id}
                  comp={comp}
                  slots={compSlots}
                  disciplines={disciplines}
                  liveSlotIds={liveSlotIds}
                  activeOverride={activeOverride ?? null}
                  isLive={hasLiveSlot}
                  onSlotAdd={async (payload) => {
                    const res = await fetch("/api/admin/ticker/schedule", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...payload, competitionId: comp.id }),
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      return err.error as string;
                    }
                    refresh();
                    return null;
                  }}
                  onSlotDelete={async (slotId) => {
                    await fetch(`/api/admin/ticker/schedule/${slotId}`, { method: "DELETE" });
                    refresh();
                  }}
                  onForceToggle={async () => {
                    if (activeOverride) {
                      await fetch(`/api/admin/ticker/override/${activeOverride.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: false }),
                      });
                    } else {
                      await fetch("/api/admin/ticker/override", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ competitionId: comp.id }),
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

      {/* ── Section 3: Custom upcoming ──────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Custom najave"
          subtitle="Ručne stavke u donjem ticker traku (pored automatskih iz baze)"
        />

        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          {customUpcoming.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {customUpcoming.map((entry) => (
                <CustomUpcomingRow
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

function SectionHeader({ title, subtitle, live }: { title: string; subtitle: string; live?: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div>
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
    </div>
  );
}

// ── OverrideRow ───────────────────────────────────────────────────────────────

function OverrideRow({
  override, compName, onToggle, onDelete,
}: {
  override: Override;
  compName: string;
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full shrink-0 ${override.isActive ? "bg-[var(--brand-primary)]" : "bg-[var(--border-strong)]"}`} />
      <span className="flex-1 text-xs font-medium text-[var(--ink)] truncate">{compName}</span>
      {override.label && (
        <span className="text-xs text-[var(--muted)] shrink-0">{override.label}</span>
      )}
      <span className={`text-xs font-semibold shrink-0 ${override.isActive ? "text-[var(--brand-primary)]" : "text-[var(--muted)]"}`}>
        {override.isActive ? "Aktivno" : "Neaktivno"}
      </span>
      <button
        onClick={async () => { setLoading(true); await onToggle(); setLoading(false); }}
        disabled={loading}
        className={btnGhost}
      >
        {override.isActive ? "Pauziraj" : "Aktiviraj"}
      </button>
      <button
        onClick={async () => { setLoading(true); await onDelete(); setLoading(false); }}
        disabled={loading}
        className={btnDanger}
      >
        Ukloni
      </button>
    </div>
  );
}

// ── CompetitionScheduleRow ────────────────────────────────────────────────────

function CompetitionScheduleRow({
  comp, slots, disciplines, liveSlotIds, activeOverride, isLive,
  onSlotAdd, onSlotDelete, onForceToggle,
}: {
  comp: CompetitionRow;
  slots: SlotRow[];
  disciplines: DisciplineOption[];
  liveSlotIds: number[];
  activeOverride: Override | null;
  isLive: boolean;
  onSlotAdd: (payload: { disciplineId: number; stage: string; startTime: string; endTime: string | null }) => Promise<string | null>;
  onSlotDelete: (slotId: number) => Promise<void>;
  onForceToggle: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [forceLoading, setForceLoading] = useState(false);

  const levelStyle = LEVEL_STYLE[comp.level] ?? { background: "var(--surface-2)", color: "var(--muted)" };

  return (
    <div>
      {/* Competition header */}
      <div className="px-4 py-3 flex items-center gap-3 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[var(--muted)] shrink-0 transition-transform duration-150"
          style={{ transform: expanded ? "rotate(90deg)" : undefined }}
          aria-label={expanded ? "Zatvori" : "Otvori satniću"}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Live dot */}
        {(isLive || activeOverride?.isActive) && (
          <LiveDot />
        )}

        {/* Name */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left text-sm font-medium text-[var(--ink)] truncate hover:text-[var(--brand-primary)] transition-colors"
        >
          {comp.name}
        </button>

        {/* Date range */}
        <span className="text-xs text-[var(--muted)] shrink-0 hidden sm:block">
          {formatDateRange(comp.date, comp.dateEnd)}
        </span>

        {/* Level badge */}
        <span
          className="shrink-0 hidden sm:inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide"
          style={{ background: levelStyle.background, color: levelStyle.color }}
        >
          {LEVEL_LABEL[comp.level] ?? comp.level}
        </span>

        {/* Slot count */}
        <span className="text-xs text-[var(--subtle)] shrink-0 w-12 text-right">
          {slots.length} {slots.length === 1 ? "slot" : "slotova"}
        </span>

        {/* Force live toggle */}
        <button
          onClick={async () => { setForceLoading(true); await onForceToggle(); setForceLoading(false); }}
          disabled={forceLoading}
          className={activeOverride?.isActive ? btnDanger : btnGhost}
        >
          {activeOverride?.isActive ? (
            <><span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] inline-block" /> Forsirano</>
          ) : (
            "Forsirati live"
          )}
        </button>
      </div>

      {/* Expanded: slots + add form */}
      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)]">
          {/* Existing slots */}
          {slots.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {slots
                .slice()
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((slot) => {
                  const live = liveSlotIds.includes(slot.id);
                  return (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      live={live}
                      onDelete={() => onSlotDelete(slot.id)}
                    />
                  );
                })}
            </div>
          )}

          {/* Add slot form */}
          <AddSlotForm
            disciplines={disciplines}
            compDateStart={comp.date}
            compDateEnd={comp.dateEnd ?? comp.date}
            onAdd={onSlotAdd}
          />
        </div>
      )}
    </div>
  );
}

// ── SlotRow ───────────────────────────────────────────────────────────────────

function SlotRow({ slot, live, onDelete }: { slot: SlotRow; live: boolean; onDelete: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className={`px-6 py-2.5 flex items-center gap-4 text-xs ${live ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
      {live && <LiveDot />}
      <span className="font-mono font-bold text-[var(--brand-primary)] w-10 shrink-0">{slot.disciplineCode}</span>
      <span className="w-40 shrink-0 text-[var(--ink)] font-medium">{STAGE_LABEL[slot.stage] ?? slot.stage}</span>
      <span className="text-[var(--muted)] shrink-0">{fmtDatetime(slot.startTime)}</span>
      {slot.endTime && (
        <>
          <span className="text-[var(--border-strong)]">→</span>
          <span className="text-[var(--muted)] shrink-0">{fmtDatetime(slot.endTime)}</span>
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

function AddSlotForm({
  disciplines, compDateStart, compDateEnd, onAdd,
}: {
  disciplines: DisciplineOption[];
  compDateStart: string;
  compDateEnd: string;
  onAdd: (p: { disciplineId: number; stage: string; startTime: string; endTime: string | null }) => Promise<string | null>;
}) {
  const [disciplineId, setDisciplineId] = useState("");
  const [stage, setStage] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = disciplineId && stage && startTime;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);
    const err = await onAdd({
      disciplineId: parseInt(disciplineId),
      stage,
      startTime,
      endTime: endTime || null,
    });
    setLoading(false);
    if (err) { setError(err); return; }
    setDisciplineId("");
    setStage("");
    setStartTime("");
    setEndTime("");
  }

  return (
    <form onSubmit={submit} className="px-6 py-3 flex flex-wrap items-end gap-3 border-t border-dashed border-[var(--border)]">
      <div className="flex flex-col gap-1 w-36">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Disciplina</label>
        <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className={selectCls} required>
          <option value="">Izaberi…</option>
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>{d.code}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 w-44">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Faza</label>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={selectCls} required>
          <option value="">Izaberi…</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Početak</label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          min={`${compDateStart}T00:00`}
          max={`${compDateEnd}T23:59`}
          className={inputCls}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Kraj (opciono)</label>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          min={startTime || `${compDateStart}T00:00`}
          max={`${compDateEnd}T23:59`}
          className={inputCls}
        />
      </div>

      <button type="submit" disabled={!valid || loading} className={`${btnPrimary} disabled:opacity-40 self-end`}>
        + Dodaj slot
      </button>

      {error && <p className="w-full text-xs text-[var(--brand-primary)] mt-1">{error}</p>}
    </form>
  );
}

// ── CustomUpcomingRow ─────────────────────────────────────────────────────────

function CustomUpcomingRow({ entry, onDelete }: { entry: CustomUpcomingRow; onDelete: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="px-4 py-3 flex items-center gap-4 text-xs">
      {entry.date && (
        <span className="font-mono text-[var(--muted)] shrink-0 w-20">
          {entry.date.split("-").reverse().join(".")}
        </span>
      )}
      <span className="flex-1 font-medium text-[var(--ink)] truncate">{entry.text}</span>
      {entry.href && (
        <span className="text-[var(--subtle)] truncate max-w-[140px] shrink-0">{entry.href}</span>
      )}
      {entry.displayUntil && (
        <span className="text-[var(--subtle)] shrink-0">do {entry.displayUntil.split("-").reverse().join(".")}</span>
      )}
      <button
        onClick={async () => { setLoading(true); await onDelete(); setLoading(false); }}
        disabled={loading}
        className={btnDanger}
      >
        Ukloni
      </button>
    </div>
  );
}

// ── AddCustomUpcomingForm ─────────────────────────────────────────────────────

function AddCustomUpcomingForm({ onAdd }: {
  onAdd: (p: { text: string; date: string | null; href: string | null; displayUntil: string | null }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [href, setHref] = useState("");
  const [displayUntil, setDisplayUntil] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    await onAdd({
      text: text.trim(),
      date: date || null,
      href: href || null,
      displayUntil: displayUntil || null,
    });
    setLoading(false);
    setText(""); setDate(""); setHref(""); setDisplayUntil("");
  }

  return (
    <form onSubmit={submit} className="px-4 py-3 flex flex-wrap items-end gap-3 bg-[var(--surface)]">
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Tekst najave</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="npr. Kup Srbije — Vazdušni Pištolj"
          className={inputCls}
          required
        />
      </div>

      <div className="flex flex-col gap-1 w-32">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Datum</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      </div>

      <div className="flex flex-col gap-1 w-40">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Link (opciono)</label>
        <input type="url" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/takmicenja/123" className={inputCls} />
      </div>

      <div className="flex flex-col gap-1 w-32">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">Prikazuj do</label>
        <input type="date" value={displayUntil} onChange={(e) => setDisplayUntil(e.target.value)} className={inputCls} />
      </div>

      <button type="submit" disabled={!text.trim() || loading} className={`${btnPrimary} disabled:opacity-40 self-end`}>
        + Dodaj
      </button>
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
