"use client";

import { useState, useRef, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { LevelDropdown } from "@/components/ui/LevelDropdown";
import { TranslatedNameInput } from "@/components/ui/TranslatedNameInput";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

interface Competition {
  id: number;
  name: string;
  nameSr?: string | null;
  nameEn?: string | null;
  date: string;
  dateEnd?: string | null;
  location: string | null;
  level: CompetitionLevel;
  issfId?: string | null;
  siusId?: string | null;
  tags: string[];
  resultCount: number;
}

const TAG_SUGGESTIONS = ["SSS", "ISSF", "ESC", "10m", "25m", "50m"];

const inputCls = "w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]";

function detectLang(text: string): "sr" | "en" {
  return /[čćšđžČĆŠĐŽ]/.test(text) ? "sr" : "en";
}

export function CompetitionEditClient({ competition }: { competition: Competition }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    name: competition.name,
    nameSr: competition.nameSr ?? "",
    nameEn: competition.nameEn ?? "",
    date: competition.date,
    dateEnd: competition.dateEnd ?? "",
    location: competition.location ?? "",
    level: competition.level,
    issfId: competition.issfId ?? "",
    siusId: competition.siusId ?? "",
  });
  const [tags, setTags] = useState<string[]>(competition.tags);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addTag(value: string) {
    const v = value.trim();
    if (!v || tags.includes(v)) { setTagInput(""); return; }
    setTags((t) => [...t, v]);
    setTagInput("");
    tagInputRef.current?.focus();
  }

  function removeTag(tag: string) {
    setTags((t) => t.filter((x) => x !== tag));
  }

  function onTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
    if (e.key === "Backspace" && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/competitions/${competition.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      router.push("/admin/takmicenja");
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/competitions/${competition.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška pri brisanju");
      router.push("/admin/takmicenja");
      router.refresh();
    } catch (e) {
      setError(String(e));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const detectedLang = detectLang(form.name);

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Uredi takmičenje
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          ID #{competition.id} · {competition.resultCount} rezultata
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Podaci</h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Naziv *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <TranslatedNameInput
              sourceName={form.name}
              from={detectedLang}
              to="sr"
              value={form.nameSr}
              onChange={(v) => set("nameSr", v)}
              label="Naziv (SR)"
              placeholder="Srpski naziv"
            />
            <TranslatedNameInput
              sourceName={form.name}
              from={detectedLang}
              to="en"
              value={form.nameEn}
              onChange={(v) => set("nameEn", v)}
              label="Naziv (EN)"
              placeholder="English name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum od *</label>
              <DatePicker value={form.date} onChange={(v) => set("date", v)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum do</label>
              <DatePicker value={form.dateEnd} onChange={(v) => set("dateEnd", v)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Nivo *</label>
            <LevelDropdown value={form.level} onChange={(v) => set("level", v)} />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Lokacija</label>
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="npr. Beograd, SC Crvena zvezda"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">ISSF ID</label>
            <input
              value={form.issfId}
              onChange={(e) => set("issfId", e.target.value)}
              placeholder="npr. 3277"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Broj iz URL-a na issf-sports.org/competitions/<strong>{form.issfId || "3277"}</strong> — fallback za live fetch.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">SIUS ID</label>
            <input
              value={form.siusId}
              onChange={(e) => set("siusId", e.target.value)}
              placeholder="npr. 3c4bac7a-06f1-4726-b512-521623fccb2e"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">RunningId sa shootingsportscloud.com:8594 — primarni live izvor (real-time iz SIUS hardware).</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Tagovi</label>
            <div className="flex flex-wrap gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-2 focus-within:border-[var(--brand-primary)] focus-within:ring-1 focus-within:ring-[var(--brand-primary)] transition-colors min-h-[40px]">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-[var(--surface-2)] text-[var(--ink)]">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`Ukloni ${tag}`} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors leading-none">×</button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={tags.length === 0 ? "Dodaj tag…" : ""}
                className="flex-1 min-w-[80px] bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--muted)] outline-none py-0.5"
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {TAG_SUGGESTIONS.filter((s) => !tags.includes(s)).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  className="px-2 py-0.5 rounded text-[0.7rem] font-semibold bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)] transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Snimam..." : "Sačuvaj izmene"}
          </button>
          <Link
            href="/admin/takmicenja"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Otkaži
          </Link>
        </div>
      </form>

      {/* Delete zone */}
      <div className="mt-8 rounded-xl border border-red-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">Opasna zona</h2>
        {competition.resultCount > 0 && (
          <p className="text-xs text-[var(--muted)] mb-3">
            Brisanjem takmičenja biće obrisano i <strong>{competition.resultCount} rezultata</strong> vezanih za njega.
          </p>
        )}
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Obriši takmičenje
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--ink)]">Sigurno?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? "Brišem..." : "Da, obriši"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Otkaži
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
