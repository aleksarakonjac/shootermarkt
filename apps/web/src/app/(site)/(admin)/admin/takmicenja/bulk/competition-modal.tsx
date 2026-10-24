"use client";

import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { LevelDropdown } from "@/components/ui/LevelDropdown";
import { TranslatedNameInput } from "@/components/ui/TranslatedNameInput";
import { CountryDropdown } from "@/components/ui/CountryDropdown";
import { FocusPriorityField } from "@/components/ui/FocusPriorityField";
import { defaultFocusPriority } from "@/lib/competition-priority";
import type { CompetitionMatch } from "@/app/api/admin/competitions/[id]/matches/route";
import { AGE_CATEGORIES, EVENT_TYPES } from "../sync/sync-row-editor";
import { TAG_OPTIONS } from "../takmicenja-filters";
import type { BulkRow, Country, Editable, MatchDraft } from "./bulk-editor";

type Form = Record<Exclude<keyof Editable, "tags" | "disciplineGroups">, string> & { tags: string; disciplineGroups: string[] };

const toForm = (c: Editable): Form => ({
  name: c.name,
  nameSr: c.nameSr ?? "",
  nameEn: c.nameEn ?? "",
  date: c.date,
  dateEnd: c.dateEnd ?? "",
  location: c.location ?? "",
  locationSr: c.locationSr ?? "",
  locationEn: c.locationEn ?? "",
  countryId: c.countryId == null ? "" : String(c.countryId),
  level: c.level,
  eventType: c.eventType,
  ageCategory: c.ageCategory,
  focusPriority: c.focusPriority == null ? "" : String(c.focusPriority),
  organizer: c.organizer ?? "",
  issfId: c.issfId ?? "",
  siusId: c.siusId ?? "",
  sourcePdfUrl: c.sourcePdfUrl ?? "",
  timezone: c.timezone,
  tags: c.tags.join(", "),
  disciplineGroups: c.disciplineGroups,
});

const orNull = (s: string) => s.trim() || null;
const fromForm = (f: Form): Editable => ({
  name: f.name.trim(),
  nameSr: orNull(f.nameSr),
  nameEn: orNull(f.nameEn),
  date: f.date,
  dateEnd: f.dateEnd && f.dateEnd !== f.date ? f.dateEnd : null,
  location: orNull(f.location),
  locationSr: orNull(f.locationSr),
  locationEn: orNull(f.locationEn),
  countryId: f.countryId ? Number(f.countryId) : null,
  level: f.level,
  eventType: f.eventType,
  ageCategory: f.ageCategory,
  focusPriority: f.focusPriority.trim() === "" ? null : Number(f.focusPriority),
  organizer: orNull(f.organizer),
  issfId: orNull(f.issfId),
  siusId: orNull(f.siusId),
  sourcePdfUrl: orNull(f.sourcePdfUrl),
  timezone: f.timezone.trim(),
  tags: [...new Set(f.tags.split(",").map((t) => t.trim()).filter(Boolean))],
  disciplineGroups: f.disciplineGroups,
});

export const matchKey = (compId: number, m: { disciplineId: number; eventId: number | null; category: string }) => `${compId}|${m.disciplineId}|${m.eventId ?? ""}|${m.category}`;

const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]";
const inputCls = "w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]";
const sectionCls = "space-y-4 border-t border-[var(--border)] pt-5";
const sectionTitle = "text-sm font-bold text-[var(--ink)]";

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return `${day}.${m}.`;
}

function validate(f: Form): string | null {
  if (!f.name.trim()) return "Originalni naziv je obavezan (Napredno).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return "Datum od je obavezan.";
  if (f.dateEnd && f.dateEnd < f.date) return "Datum do je pre datuma od.";
  if (f.focusPriority.trim() && !(/^\d{1,2}$/.test(f.focusPriority.trim()) && Number(f.focusPriority) <= 20)) return "Prioritet mora biti ceo broj 0–20 ili prazan.";
  if (f.tags.split(",").some((t) => t.trim().length > 20)) return "Tag može imati najviše 20 znakova.";
  if (!f.timezone.trim()) return "Vremenska zona je obavezna.";
  return null;
}

export function CompetitionModal({
  row,
  current,
  countries,
  matchDrafts,
  matchCache,
  onMatchesLoaded,
  onConfirm,
  onRevert,
  onClose,
}: {
  row: BulkRow;
  /** Vrednosti sa već potvrđenim (nesačuvanim) izmenama */
  current: Editable;
  countries: Country[];
  matchDrafts: Record<string, MatchDraft>;
  matchCache: CompetitionMatch[] | undefined;
  onMatchesLoaded: (competitionId: number, matches: CompetitionMatch[]) => void;
  onConfirm: (values: Editable, matchTargets: Record<string, string>) => void;
  onRevert: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(current));
  const [targets, setTargets] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(matchDrafts).filter(([k]) => k.startsWith(`${row.id}|`)).map(([k, d]) => [k, d.to]))
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (matchCache || row.resultCount === 0) return;
    let cancelled = false;
    fetch(`/api/admin/competitions/${row.id}/matches`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Greška ${res.status}`);
        if (!cancelled) onMatchesLoaded(row.id, json.matches);
      })
      .catch((e) => { if (!cancelled) setLoadError(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, [row.id, row.resultCount, matchCache, onMatchesLoaded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  function confirm() {
    const problem = validate(form);
    if (problem) { setError(problem); return; }
    onConfirm(fromForm(form), targets);
  }

  const detected = /[čćšđžČĆŠĐŽ]/.test(form.name) ? "sr" : "en";
  const autoPriority = defaultFocusPriority(
    { name: form.name, level: form.level, eventType: form.eventType, ageCategory: form.ageCategory },
    matchCache?.map((m) => targets[matchKey(row.id, m)] ?? m.category) ?? [],
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="competition-modal-title"
        className="flex max-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="competition-modal-title" className="font-[family-name:var(--font-barlow-condensed)] text-xl font-extrabold uppercase leading-tight tracking-tight text-[var(--ink)] text-balance">
              {form.nameSr || form.name}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)] tabular-nums">#{row.id} · {row.resultCount} rezultata · {row.matchCount} mečeva</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Zatvori bez izmena" className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className="space-y-4">
            <h3 className={sectionTitle}>Osnovno</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TranslatedNameInput sourceName={form.name} from={detected} to="sr" value={form.nameSr} onChange={(v) => set("nameSr", v)} label="Naziv (SR)" placeholder="Srpski naziv" />
              <TranslatedNameInput sourceName={form.name} from={detected} to="en" value={form.nameEn} onChange={(v) => set("nameEn", v)} label="Naziv (EN)" placeholder="English name" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Datum od *</label>
                <DatePicker value={form.date} onChange={(v) => set("date", v)} required />
              </div>
              <div>
                <label className={labelCls}>Datum do</label>
                <DatePicker value={form.dateEnd} onChange={(v) => set("dateEnd", v)} min={form.date} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="cm-location-sr">Lokacija (SR)</label>
                <input id="cm-location-sr" value={form.locationSr} onChange={(e) => set("locationSr", e.target.value)} placeholder="npr. Beograd" className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cm-location-en">Lokacija (EN)</label>
                <input id="cm-location-en" value={form.locationEn} onChange={(e) => set("locationEn", e.target.value)} placeholder="e.g. Belgrade" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Država održavanja</label>
              <CountryDropdown value={form.countryId} onChange={(v) => set("countryId", v)} countries={countries} />
            </div>
          </section>

          <section className={sectionCls}>
            <h3 className={sectionTitle}>Klasifikacija</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Nivo *</label>
                <LevelDropdown value={form.level} onChange={(v) => set("level", v)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cm-type">Tip</label>
                <select id="cm-type" value={form.eventType} onChange={(e) => set("eventType", e.target.value)} className={inputCls}>
                  {EVENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="cm-age">Uzrast takmičenja</label>
                <select id="cm-age" value={form.ageCategory} onChange={(e) => set("ageCategory", e.target.value)} className={inputCls}>
                  {AGE_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <FocusPriorityField value={form.focusPriority} onChange={(v) => set("focusPriority", v)} autoValue={autoPriority} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="cm-tags">Tagovi</label>
                <input id="cm-tags" list="cm-tag-options" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="npr. sss, issf" className={inputCls} />
                <datalist id="cm-tag-options">{TAG_OPTIONS.map((t) => <option key={t.value} value={t.value} />)}</datalist>
                <p className="mt-1 text-[11px] text-[var(--muted)]">Odvojeni zarezom.</p>
              </div>
              <div>
                <label className={labelCls} htmlFor="cm-organizer">Organizator</label>
                <input id="cm-organizer" value={form.organizer} onChange={(e) => set("organizer", e.target.value)} placeholder="npr. SSS, ISSF, ESC" className={inputCls} />
              </div>
            </div>
            <fieldset>
              <legend className={labelCls}>Discipline (filter na /takmicenja)</legend>
              <div className="flex flex-wrap gap-4">
                {[{ key: "air", label: "Vazdušno (10m)" }, { key: "smallbore", label: "Malokalibarsko (25m / 50m)" }].map((g) => (
                  <label key={g.key} className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={form.disciplineGroups.includes(g.key)}
                      onChange={(e) => set("disciplineGroups", e.target.checked ? [...form.disciplineGroups, g.key] : form.disciplineGroups.filter((x) => x !== g.key))}
                    />
                    {g.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className={sectionCls}>
            <h3 className={sectionTitle}>Izvori</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="cm-issf">ISSF ID</label>
                <input id="cm-issf" value={form.issfId} onChange={(e) => set("issfId", e.target.value)} placeholder="npr. 3277" className={`${inputCls} font-[family-name:var(--font-jetbrains-mono)]`} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cm-sius">SIUS ID</label>
                <input id="cm-sius" value={form.siusId} onChange={(e) => set("siusId", e.target.value)} placeholder="RunningId" className={`${inputCls} font-[family-name:var(--font-jetbrains-mono)]`} />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="cm-pdf">Bilten (PDF URL)</label>
              <input id="cm-pdf" value={form.sourcePdfUrl} onChange={(e) => set("sourcePdfUrl", e.target.value)} placeholder="https://…" className={inputCls} />
            </div>
          </section>

          <section className={sectionCls}>
            <h3 className={sectionTitle}>Mečevi</h3>
            {row.resultCount === 0 ? (
              <p className="text-sm text-[var(--muted)]">Takmičenje još nema rezultata.</p>
            ) : loadError ? (
              <p role="alert" className="text-sm text-[var(--brand-primary)]">Mečevi nisu učitani: {loadError}</p>
            ) : !matchCache ? (
              <p className="text-sm text-[var(--muted)]">Učitavam mečeve…</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {matchCache.map((m) => {
                  const key = matchKey(row.id, m);
                  const value = targets[key] ?? m.category;
                  const missingAge = m.shooters.length - m.knownAge;
                  return (
                    <li key={key} className="relative">
                      <select
                        aria-label={`Kategorija meča ${m.code} ${m.eventName ?? ""} ${shortDate(m.date)}`}
                        value={value}
                        onChange={(e) => setTargets((t) => ({ ...t, [key]: e.target.value }))}
                        className={`absolute right-3 top-2 z-10 rounded-md border bg-[var(--bg)] px-2 py-1 text-sm ${value !== m.category ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]" : "border-[var(--border)]"}`}
                      >
                        {AGE_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 pl-3 pr-44 hover:bg-[var(--surface)] [&::-webkit-details-marker]:hidden">
                          <ChevronRight size={14} aria-hidden className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
                          <span className="w-12 font-bold text-[var(--ink)]" title={m.disciplineName}>{m.code}</span>
                          <span className="min-w-[8rem] text-sm text-[var(--ink)] tabular-nums">
                            {m.eventName ?? "Glavni meč"}
                            <span className="ml-1.5 text-[var(--muted)]">{shortDate(m.date)}</span>
                          </span>
                          <span className="text-xs text-[var(--muted)] tabular-nums">{m.shooters.length} strelaca</span>
                          <span className="text-xs tabular-nums text-[var(--muted)]" title="Najviše 20 godina u godini meča (ISSF junior)">
                            <strong className="font-semibold text-[var(--ink)]">{m.juniorAge}/{m.knownAge}</strong> junior uzrasta{missingAge > 0 && ` · ${missingAge} bez godišta`}
                          </span>
                          <span className="basis-full pl-[1.4rem] text-xs text-[var(--muted)]">
                            {m.shooters.slice(0, 3).map((s) => s.name).join(" · ")}{m.shooters.length > 3 && " …"}
                          </span>
                        </summary>
                        <table className="mb-2 ml-[1.4rem] w-[calc(100%-2.8rem)] text-sm">
                          <thead>
                            <tr className="text-left text-[0.7rem] uppercase tracking-wider text-[var(--muted)]">
                              <th scope="col" className="w-10 py-1 font-semibold">#</th>
                              <th scope="col" className="py-1 font-semibold">Strelac</th>
                              <th scope="col" className="w-20 py-1 font-semibold">Godište</th>
                              <th scope="col" className="w-24 py-1 font-semibold">Uzrast tada</th>
                              <th scope="col" className="w-20 py-1 text-right font-semibold">Kval.</th>
                            </tr>
                          </thead>
                          <tbody className="tabular-nums">
                            {m.shooters.map((s, i) => {
                              const age = s.birthYear ? Number(m.date.slice(0, 4)) - s.birthYear : null;
                              return (
                                <tr key={i} className="border-t border-[var(--border)]">
                                  <td className="py-1 text-[var(--muted)]">{s.rank ?? "—"}</td>
                                  <td className="py-1 text-[var(--ink)]">{s.name}</td>
                                  <td className="py-1 text-[var(--muted)]">{s.birthYear ?? "—"}</td>
                                  <td className={`py-1 ${age != null && age <= 20 ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}>{age == null ? "—" : `${age} god.${age <= 20 ? " · jun." : ""}`}</td>
                                  <td className="py-1 text-right text-[var(--muted)]">{s.total ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={sectionCls}>
            <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
              <ChevronRight size={14} aria-hidden className={`transition-transform ${advanced ? "rotate-90" : ""}`} />
              Napredno
            </button>
            {advanced && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls} htmlFor="cm-name">Originalni naziv iz izvora *</label>
                  <input id="cm-name" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Uvoz rezultata po ovom nazivu i datumu prepoznaje da takmičenje već postoji. Menjaj samo ako je pogrešan i u izvoru (bilten, ISSF).</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="cm-location">Originalna lokacija</label>
                    <input id="cm-location" value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="cm-tz">Vremenska zona</label>
                    <input id="cm-tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="Europe/Belgrade" className={inputCls} />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-3">
          {error && <span role="alert" className="text-sm font-medium text-[var(--brand-primary)]">{error}</span>}
          <button type="button" onClick={onRevert} className="text-sm font-semibold text-[var(--muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
            Vrati original
          </button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)]">
              Otkaži
            </button>
            <button type="button" onClick={confirm} className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]">
              Potvrdi
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
