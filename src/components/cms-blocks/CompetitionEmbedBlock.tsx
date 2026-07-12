import { Link } from "@/i18n/navigation";
import { resolveCompetition } from "@/lib/cms/resolve-competition";

export async function CompetitionEmbedBlock({ competitionId }: { competitionId: number }) {
  const competition = await resolveCompetition(competitionId);
  if (!competition) {
    return <p className="text-sm text-[var(--muted)] italic">Podaci nisu dostupni.</p>;
  }
  return (
    <Link
      href={`/takmicenja/${competition.id}`}
      className="block rounded-lg border border-[var(--border)] p-4 my-4 hover:border-[var(--brand-primary)] transition-colors"
    >
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{competition.level}</div>
      <div className="font-semibold">{competition.name}</div>
      <div className="text-sm text-[var(--muted)]">
        {competition.date}
        {competition.location ? ` · ${competition.location}` : ""}
      </div>
    </Link>
  );
}
