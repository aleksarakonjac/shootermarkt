import { Link } from "@/i18n/navigation";
import { resolveCompetition } from "@/lib/cms/resolve-competition";
import { LEVEL_STYLE, getLevelLabel } from "@/lib/competition-utils";

function formatCompDate(date: string, dateEnd: string | null): string {
  const start = new Date(date);
  const fmt = (d: Date) =>
    d.toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" });
  if (!dateEnd || dateEnd === date) return fmt(start);
  const end = new Date(dateEnd);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()}. ${start.toLocaleString("sr-Latn-RS", { month: "short" })} ${start.getFullYear()}.`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

export async function CompetitionEmbedBlock({ competitionId }: { competitionId: number }) {
  const competition = await resolveCompetition(competitionId);
  if (!competition) {
    return (
      <p className="my-4 text-sm text-[var(--muted)] italic">Podaci o takmičenju nisu dostupni.</p>
    );
  }

  const levelStyle = LEVEL_STYLE[competition.level] ?? {
    background: "var(--surface-2)",
    color: "var(--muted)",
  };

  return (
    <Link
      href={`/takmicenja/${competition.id}`}
      className="group block my-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--brand-primary)] transition-colors"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-[var(--border)]">
        <span
          className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={levelStyle}
        >
          {getLevelLabel(competition.level, "sr")}
        </span>
        <time
          className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--subtle)] tabular-nums"
          dateTime={competition.date}
        >
          {formatCompDate(competition.date, competition.dateEnd)}
        </time>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors leading-snug">
          {competition.name}
        </h3>

        <div className="flex items-center gap-4 mt-2">
          {competition.location && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
              <svg
                width="13" height="13" viewBox="0 0 16 16" fill="none"
                xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
                className="shrink-0 opacity-60"
              >
                <path
                  d="M8 1a4.5 4.5 0 0 1 4.5 4.5C12.5 9 8 15 8 15S3.5 9 3.5 5.5A4.5 4.5 0 0 1 8 1Z"
                  stroke="currentColor" strokeWidth="1.4" fill="none"
                />
                <circle cx="8" cy="5.5" r="1.5" fill="currentColor" />
              </svg>
              {competition.location}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-[var(--brand-primary)] group-hover:gap-2 transition-all">
          Pogledaj rezultate
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
