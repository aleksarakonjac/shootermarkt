import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: "Kako Shootermarkt obrađuje i štiti vaše lične podatke.",
};

const UPDATED = "5. jula 2026.";
const CONTACT_EMAIL = "kontakt@shootermarkt.rs";

// ── Prose primitives ──────────────────────────────────────────────────────────

function Section({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`s${num}`} className="scroll-mt-20">
      <h2
        className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] mb-3"
        style={{ fontSize: "1.15rem", letterSpacing: "-0.01em" }}
      >
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] mr-2 text-sm font-normal">
          {String(num).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-[var(--ink)] leading-relaxed">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.9375rem]" style={{ textWrap: "pretty" } as React.CSSProperties}>
      {children}
    </p>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 pl-4">
      {items.map((item, i) => (
        <li key={i} className="text-[0.9375rem] relative before:absolute before:-left-3 before:top-[0.55em] before:w-1 before:h-1 before:rounded-full before:bg-[var(--muted)]">
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PrivatnostPage() {
  const sections = [
    "Rukovalac podacima",
    "Podaci koji se obrađuju",
    "Svrha i osnov obrade",
    "Ko ima pristup",
    "Prava lica na koja se podaci odnose",
    "Rokovi čuvanja",
    "Kolačići i tehnički podaci",
    "Izmene politike",
    "Kontakt",
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          Politika privatnosti
        </h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          Poslednje ažuriranje: <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">{UPDATED}</span>
        </p>
        <p className="text-[0.9375rem] text-[var(--ink)] mt-4 leading-relaxed" style={{ textWrap: "pretty" } as React.CSSProperties}>
          Shootermarkt prikuplja i obrađuje lične podatke isključivo radi praćenja
          i prikaza javnih sportskih rezultata srpskih strelaca. Ova politika objašnjava
          koje podatke čuvamo, zašto i koja su vaša prava.
        </p>
      </div>

      {/* TOC */}
      <nav className="mb-10 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Sadržaj</p>
        <ol className="space-y-1.5">
          {sections.map((s, i) => (
            <li key={i}>
              <a
                href={`#s${i + 1}`}
                className="flex items-center gap-2 text-sm text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors"
              >
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--subtle)] w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      <div className="space-y-10 divide-y divide-[var(--border)]">

        <Section num={1} title="Rukovalac podacima">
          <P>
            Rukovalac podacima je Aleksa Rakonjac, Pančevo, Srbija.
            Za sva pitanja i zahteve možete nas kontaktirati na:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[var(--brand-primary)] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </P>
        </Section>

        <div className="pt-10">
          <Section num={2} title="Podaci koji se obrađuju">
            <P>Shootermarkt obrađuje sledeće kategorije podataka o strelcima:</P>
            <Ul items={[
              "Ime i prezime",
              "Godina rođenja",
              "Nacionalnost / zastupljena zemlja",
              "Klub koji strelac zastupa",
              "Streljački rezultati sa takmičenja (skoring, rang, disciplina)",
              "Fotografija (avatar), isključivo ako je strelac sam dostavi",
            ]} />
            <P>
              Svi navedeni podaci su javnog karaktera — objavljeni su od strane
              Streljačkog saveza Srbije (SSS) ili ISSF-a u zvaničnim biltenima i
              na javnim rezultatskim portalima.
            </P>
          </Section>
        </div>

        <div className="pt-10">
          <Section num={3} title="Svrha i osnov obrade">
            <P>
              Podaci se obrađuju radi prikaza streljačkih profila, rangiranja i
              istorije nastupa — u funkciji praćenja srpskog streljačkog sporta.
            </P>
            <P>
              Pravni osnov obrade: <strong>legitimni interes</strong> (čl. 12 ZZPL
              / čl. 6(1)(f) GDPR) — praćenje javnih sportskih rezultata
              profesionalnih i aktivnih sportista koji su pristali na javno
              takmičenje u okviru zvanične sportske organizacije.
            </P>
            <P>
              Za obradu fotografije osnov je <strong>izričit pristanak</strong> lica
              na koje se podaci odnose.
            </P>
          </Section>
        </div>

        <div className="pt-10">
          <Section num={4} title="Ko ima pristup">
            <P>Podacima pristupaju:</P>
            <Ul items={[
              "Administrator platforme (Aleksa Rakonjac)",
              "Supabase Inc. — baza podataka i autentifikacija (serveri u EU regionu)",
              "Vercel Inc. — hosting i isporuka stranica (edge mreža)",
            ]} />
            <P>
              Podaci se ne prodaju, ne ustupaju trećim stranama u komercijalne svrhe
              niti se koriste za profilisanje ili automatizovano donošenje odluka.
            </P>
          </Section>
        </div>

        <div className="pt-10">
          <Section num={5} title="Prava lica na koja se podaci odnose">
            <P>U skladu sa Zakonom o zaštiti podataka o ličnosti (ZZPL) imate pravo na:</P>
            <Ul items={[
              "Pristup — uvid u podatke koji se o vama čuvaju",
              "Ispravku — korekciju netačnih ili nepotpunih podataka",
              "Brisanje — zahtev za brisanje podataka (\"pravo na zaborav\")",
              "Ograničenje obrade — privremenu suspenziju obrade",
              "Prigovor — prigovor na obradu zasnovanu na legitimnom interesu",
            ]} />
            <P>
              Zahtev pošaljite na{" "}
              <a href={`mailto:${CONTACT_EMAIL}?subject=Zahtev za podatke — ZZPL`} className="font-medium text-[var(--brand-primary)] hover:underline">
                {CONTACT_EMAIL}
              </a>
              {" "}sa oznakom „Zahtev za podatke — ZZPL".
              Odgovorićemo u roku od <strong>30 dana</strong>.
            </P>
            <P>
              Ako smatrate da vaši podaci nisu zakonito obrađeni, možete podneti
              pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka
              o ličnosti (poverenik.rs).
            </P>
          </Section>
        </div>

        <div className="pt-10">
          <Section num={6} title="Rokovi čuvanja">
            <P>
              Podaci se čuvaju dok je platforma aktivna ili dok ne dobijemo zahtev
              za brisanje. Nakon zatvaranja platforme, svi lični podaci biće trajno
              obrisani u roku od 90 dana.
            </P>
            <P>
              Rezultati takmičenja koji su objavljeni u zvaničnim SSS/ISSF biltenima
              smatraju se istorijskim sportskim zapisom i mogu biti zadržani u
              anonimiziranom obliku.
            </P>
          </Section>
        </div>

        <div className="pt-10">
          <Section num={7} title="Kolačići i tehnički podaci">
            <P>
              Shootermarkt koristi isključivo <strong>session kolačić</strong> koji
              Supabase postavlja radi autentifikacije administratora. Kolačić se ne
              postavlja posetiocima koji nisu prijavljeni.
            </P>
            <P>
              Ne koristimo analitičke servise (Google Analytics i sl.), piksele
              za praćenje niti reklamne mreže. Server logovi (IP adrese, User-Agent)
              koje automatski generiše Vercel mogu biti privremeno dostupni u svrhu
              otklanjanja tehničkih grešaka.
            </P>
          </Section>
        </div>

        <div className="pt-10">
          <Section num={8} title="Izmene politike">
            <P>
              O značajnim izmenama politike privatnosti obavestićemo putem istaknutog
              obaveštenja na platformi. Datum poslednjeg ažuriranja prikazan je na
              vrhu ove stranice.
            </P>
          </Section>
        </div>

        <div className="pt-10">
          <Section num={9} title="Kontakt">
            <P>
              Za sva pitanja u vezi sa ovom politikom ili obradom vaših podataka:
            </P>
            <P>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-[var(--brand-primary)] hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </P>
            <P>
              Ili koristite{" "}
              <Link href="/kontakt" className="text-[var(--brand-primary)] hover:underline">
                kontakt stranicu
              </Link>
              {" "}za slanje strukturiranog zahteva.
            </P>
          </Section>
        </div>

      </div>
    </div>
  );
}
