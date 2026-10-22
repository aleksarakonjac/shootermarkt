"use client";

import "./globals.css";

// Zamenjuje root layout kad on sam pukne — nema next-intl providera, pa je tekst dvojezičan.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="sr">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg)] px-4 text-center text-[var(--ink)]">
        <title>Shootermarkt</title>
        <p className="text-[var(--muted)]">Greška pri učitavanju. / Something went wrong.</p>
        <button type="button" onClick={() => unstable_retry()} className="font-semibold text-[var(--brand-primary)] hover:underline">
          Pokušaj ponovo / Try again
        </button>
        {error.digest && <p className="font-mono text-xs text-[var(--subtle)]">{error.digest}</p>}
      </body>
    </html>
  );
}
