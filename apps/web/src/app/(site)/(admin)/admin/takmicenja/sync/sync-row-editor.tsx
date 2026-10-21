"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { LevelDropdown } from "@/components/ui/LevelDropdown";
import { CountryDropdown } from "@/components/ui/CountryDropdown";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { TranslatedNameInput } from "@/components/ui/TranslatedNameInput";
import { FocusPriorityField } from "@/components/ui/FocusPriorityField";
import { defaultFocusPriority } from "@/lib/competition-priority";
import { formatDateSr } from "@/lib/date-utils";

export interface Draft {
  name: string;
  nameSr: string;
  nameEn: string;
  dateFrom: string;
  dateTo: string;
  location: string;
  locationSr: string;
  locationEn: string;
  countryId: string;
  level: string;
  eventType: string;
  ageCategory: string;
  focusPriority: string;
  organizer: string;
  issfId: string;
  siusId: string;
  disciplineGroups: string[];
  tags: string[];
}

export interface SiusSuggestion {
  id: string;
  name: string;
  city: string | null;
  start: string;
  score: number;
  /** Strong match — pre-filled into the draft automatically. */
  confident: boolean;
}

export type Country = { id: number; name: string; code2: string | null };

export const EVENT_TYPES = [
  { value: "championship", label: "Prvenstvo" },
  { value: "world_cup", label: "Svetski kup" },
  { value: "champions_league", label: "Champions League" },
  { value: "cup", label: "Kup" },
  { value: "grand_prix", label: "Grand Prix" },
  { value: "league_round", label: "Kolo lige" },
  { value: "friendly", label: "Prijateljski" },
  { value: "other", label: "Ostalo" },
];

export const AGE_CATEGORIES = [
  { value: "open", label: "Open" },
  { value: "senior", label: "Senior" },
  { value: "mladji_senior", label: "Mlađi senior" },
  { value: "junior", label: "Junior" },
  { value: "mladji_junior", label: "Mlađi junior (U18)" },
  { value: "kadet", label: "Kadet" },
  { value: "pionir", label: "Pionir" },
  { value: "master", label: "Master" },
];

const DISCIPLINE_GROUPS = [
  { key: "air", label: "Vazdušno (10m)" },
  { key: "smallbore", label: "Malokalibarsko (25m / 50m)" },
];

const inputCls =
  "w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1";

function detectLang(text: string): "sr" | "en" {
  return /[čćšđžČĆŠĐŽ]/.test(text) ? "sr" : "en";
}

function Field({ label, htmlFor, className = "", children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function TagsField({ tags, lockedTag, onChange }: { tags: string[]; lockedTag: string; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const add = (raw: string) => {
    const v = raw.trim().toLowerCase();
    setInput("");
    if (v && v !== lockedTag && !tags.includes(v)) onChange([...tags, v]);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <div
      className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 focus-within:border-[var(--brand-primary)] focus-within:ring-1 focus-within:ring-[var(--brand-primary)]"
      onClick={() => ref.current?.focus()}
    >
      <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]" title="Izvor — dodaje se uvek">{lockedTag}</span>
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--ink)]">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} aria-label={`Ukloni ${tag}`} className="leading-none text-[var(--muted)] hover:text-[var(--ink)]">×</button>
        </span>
      ))}
      <input
        ref={ref}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(input)}
        aria-label="Dodaj tag"
        placeholder="Dodaj tag…"
        className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
      />
    </div>
  );
}

export function SyncRowEditor({
  id,
  draft,
  source,
  countries,
  sourceCountry,
  siusSuggestion,
  dbMatch,
  linked = false,
  onLinkChange,
  edited,
  onChange,
  onReset,
}: {
  id: string;
  draft: Draft;
  source: string;
  countries: Country[];
  sourceCountry: string | null;
  siusSuggestion?: SiusSuggestion | null;
  /** Existing DB competition this event may duplicate; `linked` = complete it instead of inserting. */
  dbMatch?: { id: number; name: string; date: string } | null;
  linked?: boolean;
  onLinkChange?: (linked: boolean) => void;
  edited: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onReset: () => void;
}) {
  const lang = detectLang(draft.name);
  const autoPriority = defaultFocusPriority({
    name: draft.name,
    level: draft.level || "national",
    eventType: draft.eventType,
    ageCategory: draft.ageCategory,
  });
  const countryUnresolved = !draft.countryId && !!sourceCountry;

  return (
    <div id={id} className="grid grid-cols-1 gap-x-4 gap-y-4 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-5 md:grid-cols-12">
      {dbMatch && (
        <fieldset className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-4 py-3 md:col-span-12">
          <legend className="sr-only">Već postoji u bazi</legend>
          <p className="text-sm font-semibold text-[var(--ink)]">Već postoji u bazi: {dbMatch.name} <span className="font-normal text-[var(--muted)]">· {formatDateSr(dbMatch.date)}</span></p>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:gap-6">
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
              <input type="radio" name={`${id}-link`} checked={linked} onChange={() => onLinkChange?.(true)} className="accent-[var(--brand-primary)]" />
              Dopuni postojeće (ISSF ID, SIUS UUID, država)
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
              <input type="radio" name={`${id}-link`} checked={!linked} onChange={() => onLinkChange?.(false)} className="accent-[var(--brand-primary)]" />
              Uvezi kao novo takmičenje
            </label>
          </div>
          {linked && <p className="mt-1 text-xs text-[var(--muted)]">Naziv, datumi i nivo postojećeg takmičenja ostaju kakvi jesu; polja ispod se koriste samo za ISSF ID, SIUS UUID i državu.</p>}
        </fieldset>
      )}
      <Field label="Naziv *" htmlFor={`${id}-name`} className="md:col-span-12">
        <input id={`${id}-name`} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} className={inputCls} />
      </Field>

      <div className="md:col-span-6">
        <TranslatedNameInput sourceName={draft.name} from={lang} to="sr" value={draft.nameSr} onChange={(v) => onChange({ nameSr: v })} label="Naziv (SR)" placeholder="Srpski naziv" />
      </div>
      <div className="md:col-span-6">
        <TranslatedNameInput sourceName={draft.name} from={lang} to="en" value={draft.nameEn} onChange={(v) => onChange({ nameEn: v })} label="Naziv (EN)" placeholder="English name" />
      </div>

      <Field label="Datum od *" className="md:col-span-3">
        <DatePicker value={draft.dateFrom} onChange={(v) => onChange({ dateFrom: v })} />
      </Field>
      <Field label="Datum do" className="md:col-span-3">
        <DatePicker value={draft.dateTo} onChange={(v) => onChange({ dateTo: v })} />
      </Field>
      <Field label="Nivo *" className="md:col-span-3">
        <LevelDropdown value={draft.level} onChange={(v) => onChange({ level: v })} />
      </Field>
      <Field label="Tip" className="md:col-span-3">
        <SearchDropdown value={draft.eventType} onChange={(v) => onChange({ eventType: v || "other" })} options={EVENT_TYPES} searchable={false} showEmptyOption={false} />
      </Field>

      <Field label="Kategorija" className="md:col-span-3">
        <SearchDropdown value={draft.ageCategory} onChange={(v) => onChange({ ageCategory: v || "open" })} options={AGE_CATEGORIES} searchable={false} showEmptyOption={false} />
      </Field>
      <div className="md:col-span-6">
        <FocusPriorityField value={draft.focusPriority} onChange={(v) => onChange({ focusPriority: v })} autoValue={autoPriority} />
      </div>
      <Field label="Organizator" htmlFor={`${id}-org`} className="md:col-span-3">
        <input id={`${id}-org`} value={draft.organizer} onChange={(e) => onChange({ organizer: e.target.value })} placeholder="ISSF, ESC, SSS…" className={inputCls} />
      </Field>

      <Field label="Lokacija" htmlFor={`${id}-loc`} className="md:col-span-6">
        <input id={`${id}-loc`} value={draft.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="npr. Beograd, SC Crvena zvezda" className={inputCls} />
      </Field>
      <Field label="Država održavanja" className="md:col-span-6">
        <CountryDropdown value={draft.countryId} onChange={(v) => onChange({ countryId: v })} countries={countries} />
        {countryUnresolved && (
          <p className="mt-1 text-[11px] text-amber-700">Izvor navodi „{sourceCountry}“ — nije pronađeno u bazi država, izaberi ručno.</p>
        )}
      </Field>

      <Field label="Lokacija (SR)" htmlFor={`${id}-locsr`} className="md:col-span-6">
        <input id={`${id}-locsr`} value={draft.locationSr} onChange={(e) => onChange({ locationSr: e.target.value })} placeholder="Srpski naziv" className={inputCls} />
      </Field>
      <Field label="Lokacija (EN)" htmlFor={`${id}-locen`} className="md:col-span-6">
        <input id={`${id}-locen`} value={draft.locationEn} onChange={(e) => onChange({ locationEn: e.target.value })} placeholder="English name" className={inputCls} />
      </Field>

      <Field label="ISSF ID" htmlFor={`${id}-issf`} className="md:col-span-4">
        <input id={`${id}-issf`} value={draft.issfId} onChange={(e) => onChange({ issfId: e.target.value })} placeholder="npr. 3277" className={`${inputCls} font-[family-name:var(--font-jetbrains-mono)]`} />
      </Field>
      <Field label="SIUS UUID" htmlFor={`${id}-sius`} className="md:col-span-8">
        <input id={`${id}-sius`} value={draft.siusId} onChange={(e) => onChange({ siusId: e.target.value })} placeholder="3c4bac7a-06f1-4726-b512-521623fccb2e" className={`${inputCls} font-[family-name:var(--font-jetbrains-mono)]`} />
        {siusSuggestion && draft.siusId === siusSuggestion.id && (
          <p className="mt-1 text-xs text-green-700">Automatski pronađeno: {siusSuggestion.name}{siusSuggestion.city ? ` · ${siusSuggestion.city}` : ""} · {siusSuggestion.start}</p>
        )}
        {siusSuggestion && draft.siusId !== siusSuggestion.id && (
          <button type="button" onClick={() => onChange({ siusId: siusSuggestion.id })} className="mt-1 min-h-11 text-left text-xs text-[var(--brand-primary)] underline underline-offset-2">
            {siusSuggestion.confident ? "Predlog" : "Mogući SIUS (nesiguran)"}: {siusSuggestion.name}{siusSuggestion.city ? ` · ${siusSuggestion.city}` : ""} · {siusSuggestion.start} — primeni
          </button>
        )}
      </Field>

      <div className="md:col-span-6">
        <span className={labelCls}>Disciplina (filter)</span>
        <div className="flex flex-wrap gap-x-4">
          {DISCIPLINE_GROUPS.map((g) => (
            <label key={g.key} className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                className="accent-[var(--brand-primary)]"
                checked={draft.disciplineGroups.includes(g.key)}
                onChange={(e) => onChange({ disciplineGroups: e.target.checked ? [...draft.disciplineGroups, g.key] : draft.disciplineGroups.filter((x) => x !== g.key) })}
              />
              {g.label}
            </label>
          ))}
        </div>
      </div>
      <Field label="Tagovi" className="md:col-span-6">
        <TagsField tags={draft.tags} lockedTag={source} onChange={(tags) => onChange({ tags })} />
      </Field>

      <div className="flex justify-end md:col-span-12">
        <button
          type="button"
          onClick={onReset}
          disabled={!edited}
          className="min-h-11 rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Vrati na vrednosti iz izvora
        </button>
      </div>
    </div>
  );
}
