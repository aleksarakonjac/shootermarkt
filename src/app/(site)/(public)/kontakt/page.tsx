import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Kontaktirajte Shootermarkt tim ili podnesite zahtev za podatke.",
};

const CONTACT_EMAIL = "kontakt@shootermarkt.rs";

function MailLink({
  email,
  subject,
  label,
}: {
  email: string;
  subject?: string;
  label?: string;
}) {
  const href = subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 font-semibold text-[var(--brand-primary)] hover:underline transition-colors"
    >
      {label ?? email}
    </a>
  );
}

export default function KontaktPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          Kontakt
        </h1>
        <p className="text-[0.9375rem] text-[var(--ink)] mt-3 leading-relaxed" style={{ textWrap: "pretty" } as React.CSSProperties}>
          Možete nas kontaktirati za opšta pitanja, prijavu grešaka u podacima
          ili zahteve u skladu sa Zakonom o zaštiti podataka o ličnosti.
        </p>
      </div>

      {/* Two sections */}
      <div className="space-y-8">

        {/* General contact */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <h2
            className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] mb-4"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.01em" }}
          >
            Opšti kontakt
          </h2>
          <div className="space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink)]">
            <p>
              Za pitanja o platformi, prijavu netačnih podataka, predloge i
              saradnju:
            </p>
            <p>
              <MailLink email={CONTACT_EMAIL} />
            </p>
            <p className="text-sm text-[var(--muted)]">
              Odgovaramo u roku od nekoliko radnih dana.
            </p>
          </div>
        </div>

        {/* ZZPL data requests */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <h2
            className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] mb-1"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.01em" }}
          >
            Zahtev za podatke
          </h2>
          <p className="text-xs text-[var(--muted)] mb-4 font-[family-name:var(--font-jetbrains-mono)]">
            Pravo na pristup, ispravku i brisanje
          </p>
          <div className="space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink)]">
            <p>
              Ako tražite uvid, ispravku ili brisanje ličnih podataka koji se
              odnose na vas, pošaljite zahtev na:
            </p>
            <p>
              <MailLink
                email={CONTACT_EMAIL}
                subject="Zahtev za podatke"
                label={`${CONTACT_EMAIL} · predmet: "Zahtev za podatke"`}
              />
            </p>

            {/* What to include */}
            <div className="mt-4 p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <p className="text-sm font-semibold text-[var(--ink)] mb-2">
                Navedite u poruci:
              </p>
              <ol className="space-y-1.5 text-sm text-[var(--muted)]">
                {[
                  "Ime i prezime kako figuriše na platformi",
                  "Vrstu zahteva: uvid / ispravka / brisanje / ograničenje",
                  "Za ispravku: tačan podatak koji treba izmeniti i izvor (bilten, URL)",
                  "Kontakt za povratnu informaciju",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] shrink-0 w-4">
                      {i + 1}.
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            <p className="text-sm text-[var(--muted)]">
              Odgovaramo u roku od{" "}
              <strong className="text-[var(--ink)]">30 dana</strong> od prijema
              zahteva.
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-sm text-[var(--muted)] leading-relaxed" style={{ textWrap: "pretty" } as React.CSSProperties}>
          Više informacija o tome kako obrađujemo podatke možete pronaći u{" "}
          <a href="/privatnost" className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
            Politici privatnosti
          </a>
          .
        </p>

      </div>
    </div>
  );
}
