import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { resolveShooter } from "@/lib/cms/resolve-shooter";

const DISC_LABEL: Record<string, string> = {
  ARM: "10m Vazdušna puška M",
  ARW: "10m Vazdušna puška Ž",
  APM: "10m Vazdušni pištolj M",
  APW: "10m Vazdušni pištolj Ž",
};

const TREND_ICON: Record<string, string> = {
  up: "↑",
  down: "↓",
  stable: "→",
};

const TREND_COLOR: Record<string, string> = {
  up: "var(--success)",
  down: "var(--danger)",
  stable: "var(--subtle)",
};

export async function ShooterEmbedBlock({ shooterId }: { shooterId: number }) {
  const shooter = await resolveShooter(shooterId);
  if (!shooter) {
    return (
      <p className="my-4 text-sm text-[var(--muted)] italic">Podaci o strelacu nisu dostupni.</p>
    );
  }

  const initials = `${shooter.firstName[0] ?? ""}${shooter.lastName[0] ?? ""}`.toUpperCase();
  const { forma } = shooter;

  return (
    <Link
      href={`/strelci/${shooter.id}`}
      className="group block my-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--brand-primary)] transition-colors"
    >
      {/* Profile header */}
      <div className="flex items-center gap-4 px-4 pt-4 pb-3 border-b border-[var(--border)]">
        {/* Avatar */}
        {shooter.avatarUrl ? (
          <div className="relative shrink-0 w-14 h-14 rounded-2xl ring-1 ring-[var(--border)] overflow-hidden">
            <Image
              src={shooter.avatarUrl}
              alt={`${shooter.firstName} ${shooter.lastName}`}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className="shrink-0 w-14 h-14 rounded-2xl ring-1 ring-[var(--border)] flex items-center justify-center"
            style={{ background: "var(--brand-primary)" }}
          >
            <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-xl text-white">
              {initials}
            </span>
          </div>
        )}

        {/* Name + meta */}
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors leading-tight">
            {shooter.firstName} {shooter.lastName}
          </h3>
          <p className="text-sm text-[var(--muted)] truncate mt-0.5">
            {shooter.clubName ?? "Bez kluba"}
            {shooter.disciplineCode && (
              <span className="text-[var(--subtle)]">
                {" · "}
                {DISC_LABEL[shooter.disciplineCode] ?? shooter.disciplineCode}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Forma stats */}
      {forma && forma.forma != null ? (
        <div className="grid grid-cols-3 divide-x divide-[var(--border)] px-0">
          {/* Forma score */}
          <div className="flex flex-col items-center py-3 px-2">
            <div className="flex items-baseline gap-1">
              <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-2xl text-[var(--ink)] tabular-nums leading-none">
                {forma.forma.toFixed(1)}
              </span>
              <span
                className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-base leading-none"
                style={{ color: TREND_COLOR[forma.trend] ?? "var(--subtle)" }}
              >
                {TREND_ICON[forma.trend] ?? "→"}
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)] mt-1">
              Forma
            </span>
          </div>

          {/* Peak */}
          <div className="flex flex-col items-center py-3 px-2">
            <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-xl text-[var(--ink)] tabular-nums leading-none">
              {forma.peak != null ? forma.peak.toFixed(1) : "—"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)] mt-1">
              Vrhunac
            </span>
          </div>

          {/* Sample size */}
          <div className="flex flex-col items-center py-3 px-2">
            <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-xl text-[var(--ink)] tabular-nums leading-none">
              {forma.sampleSize}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)] mt-1">
              Nastupa
            </span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="text-sm text-[var(--muted)] italic">Nema dovoljno podataka za forma score.</p>
        </div>
      )}

      {/* Footer CTA */}
      <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center gap-1 text-[12px] font-semibold text-[var(--brand-primary)] group-hover:gap-2 transition-all">
        Profil strelca
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}
