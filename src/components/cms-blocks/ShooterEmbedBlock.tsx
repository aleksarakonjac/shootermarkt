import Link from "next/link";
import { resolveShooter } from "@/lib/cms/resolve-shooter";

export async function ShooterEmbedBlock({ shooterId }: { shooterId: number }) {
  const shooter = await resolveShooter(shooterId);
  if (!shooter) {
    return <p className="text-sm text-[var(--muted)] italic">Podaci nisu dostupni.</p>;
  }
  return (
    <Link
      href={`/strelci/${shooter.id}`}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-4 my-4 hover:border-[var(--brand-primary)] transition-colors"
    >
      <div className="h-12 w-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm font-semibold">
        {shooter.firstName[0]}
        {shooter.lastName[0]}
      </div>
      <div>
        <div className="font-semibold">
          {shooter.firstName} {shooter.lastName}
        </div>
        <div className="text-sm text-[var(--muted)]">
          {shooter.clubName ?? "Bez kluba"}
          {shooter.forma ? ` · Forma: ${shooter.forma.score.toFixed(1)}` : ""}
        </div>
      </div>
    </Link>
  );
}
