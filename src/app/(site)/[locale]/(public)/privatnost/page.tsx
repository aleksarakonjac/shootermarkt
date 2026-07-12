import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("privacy.metadata"), getLocale()]);
  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates(locale, "/privatnost"),
  };
}

const UPDATED_SR = "5. jula 2026.";
const UPDATED_EN = "July 5, 2026";
const CONTACT_EMAIL = "kontakt@shootermarkt.com";

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
    <p
      className="text-[0.9375rem]"
      style={{ textWrap: "pretty" } as React.CSSProperties}
    >
      {children}
    </p>
  );
}

function Ul({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="space-y-1 pl-4">
      {items.map((item, i) => (
        <li
          key={i}
          className="text-[0.9375rem] relative before:absolute before:-left-3 before:top-[0.6em] before:w-1 before:h-1 before:rounded-full before:bg-[var(--muted)]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PrivatnostPage() {
  const locale = await getLocale();
  const t = await getTranslations("privacy");

  const sectionsSr = [
    "Rukovalac podacima",
    "Podaci koji se obrađuju",
    "Svrha i pravni osnov obrade",
    "Ko ima pristup podacima",
    "Prava lica na koja se podaci odnose",
    "Rokovi čuvanja",
    "Kolačići i tehnički podaci",
    "Izmene politike",
    "Kontakt",
  ];

  const sectionsEn = [
    "Data Controller",
    "Data Processed",
    "Purpose and Legal Basis",
    "Who Has Access",
    "Data Subject Rights",
    "Retention Periods",
    "Cookies and Technical Data",
    "Policy Changes",
    "Contact",
  ];

  const sections = locale === "en" ? sectionsEn : sectionsSr;
  const updatedDate = locale === "en" ? UPDATED_EN : UPDATED_SR;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          {t("lastUpdatedDate")}{" "}
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">
            {updatedDate}
          </span>
        </p>
        
        {locale === "en" ? (
          <p
            className="text-[0.9375rem] text-[var(--ink)] mt-4 leading-relaxed"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Shootermarkt processes personal data exclusively for the purpose of tracking and displaying
            public shooting results of Serbian athletes. The data displayed on the
            platform is retrieved from official bulletins of the Serbian Shooting Union (SSS)
            and international results portals of the ISSF, which are publicly available documents.
            This policy describes what data we store, on what legal basis, who has
            access, how long we retain data, and what rights you have.
          </p>
        ) : (
          <p
            className="text-[0.9375rem] text-[var(--ink)] mt-4 leading-relaxed"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Shootermarkt obrađuje lične podatke isključivo u svrhu praćenja i prikaza
            javnih streljačkih rezultata srpskih sportista. Podaci koji se prikazuju na
            platformi preuzimaju se iz zvaničnih biltena Streljačkog saveza Srbije (SSS)
            i međunarodnih rezultatskih portala ISSF-a, koji su javno dostupni dokumenti.
            Ova politika opisuje koje podatke čuvamo, na kom pravnom osnovu, ko ima
            pristup, koliko dugo čuvamo podatke i koja prava imate.
          </p>
        )}
      </div>

      {/* TOC */}
      <nav className="mb-10 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          {t("tocTitle")}
        </p>
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

        {locale === "en" ? (
          <>
            {/* 01 */}
            <Section num={1} title="Data Controller">
              <P>
                The data controller is the Shootermarkt administrator.
              </P>
              <P>
                Contact for all inquiries regarding data processing:{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-[var(--brand-primary)] hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </P>
            </Section>

            {/* 02 */}
            <div className="pt-10">
              <Section num={2} title="Data Processed">
                <P>Shootermarkt processes the following categories of personal data:</P>
                <Ul
                  items={[
                    "Athlete's first and last name",
                    "Year of birth",
                    "Gender",
                    "Nationality and country of representation",
                    "Club name",
                    "Results from official shooting competitions: discipline, qualification score, rank, series, and eventual final result and rank",
                    "Photo (avatar)",
                  ]}
                />
                <P>
                  Note: the platform does not collect special categories of personal data (health data, biometric characteristics, etc.).
                </P>
              </Section>
            </div>

            {/* 03 */}
            <div className="pt-10">
              <Section num={3} title="Purpose and Legal Basis">
                <P>
                  <strong>Purpose:</strong> Tracking and displaying shooting profiles, rankings, and performance history to improve transparency and accessibility of shooting results in Serbia and worldwide.
                </P>
                <P>
                  <strong>Legal basis:</strong> Processing is performed based on <strong>legitimate interest</strong> (Art. 6(1)(f) GDPR). The legitimate interest consists of keeping records of publicly announced results of professional and registered athletes who, by participating in official competitions under the auspices of the SSS and ISSF, have agreed to be recorded in public documents.
                </P>
                <P>
                  <strong>Balance test:</strong> processing is limited to data already published in official documents; no sensitive data categories are processed; athletes have the right to object and request deletion.
                </P>
              </Section>
            </div>

            {/* 04 */}
            <div className="pt-10">
              <Section num={4} title="Who Has Access">
                <P>The data is accessed by:</P>
                <Ul
                  items={[
                    "The platform administrator — for data entry and correction purposes",
                    <>
                      <strong>Supabase Inc.</strong> (San Francisco, USA) — database and authentication provider, under EU standard contractual clauses; data is stored on servers in the European Union (Frankfurt)
                    </>,
                    <>
                      <strong>Vercel Inc.</strong> (San Francisco, USA) — hosting and web content delivery provider; standard EU contractual clauses apply
                    </>,
                  ]}
                />
                <P>
                  Data is not sold, shared with third parties for commercial purposes, used for advertising profiling, or automated decision-making.
                </P>
              </Section>
            </div>

            {/* 05 */}
            <div className="pt-10">
              <Section num={5} title="Data Subject Rights">
                <P>
                  In accordance with the General Data Protection Regulation (GDPR) and national law, you have the right to:
                </P>
                <Ul
                  items={[
                    "Access data processed about you",
                    "Request correction of inaccurate or completion of incomplete data",
                    "Request deletion of data (\"right to be forgotten\") when the basis for processing ceases to exist or when you object and the objection overrides the legitimate interest",
                    "Restrict processing while your request is being considered",
                    "Object to processing based on legitimate interest — in which case we will cease processing unless we demonstrate compelling legitimate grounds overriding your interests",
                  ]}
                />
                <P>
                  Send requests to{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Data Request — GDPR`}
                    className="font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>{" "}
                  with subject "Data Request — GDPR". We respond within <strong>30 days</strong> of receiving the request.
                </P>
              </Section>
            </div>

            {/* 06 */}
            <div className="pt-10">
              <Section num={6} title="Retention Periods">
                <P>
                  Competition results and accompanying personal data are stored as long as the platform is active, or until we receive and accept a deletion request.
                </P>
                <P>
                  In the event of platform closure, all personal data will be permanently deleted or anonymized within <strong>90 days</strong> of termination.
                </P>
                <P>
                  Anonymized aggregate statistics may be retained for scientific or historical purposes.
                </P>
              </Section>
            </div>

            {/* 07 */}
            <div className="pt-10">
              <Section num={7} title="Cookies and Technical Data">
                <P>
                  Shootermarkt uses only a <strong>session cookie</strong> set by Supabase for administrator account authentication. The cookie is technically necessary and is not set for non-administrative visitors.
                </P>
                <P>We do not use:</P>
                <Ul
                  items={[
                    "analytical services (Google Analytics, Plausible, etc.)",
                    "tracking pixels or advertising networks",
                    "third-party cookies",
                  ]}
                />
                <P>
                  Server logs (IP address, User-Agent, access time) automatically generated by Vercel are temporarily available for troubleshooting and security monitoring.
                </P>
              </Section>
            </div>

            {/* 08 */}
            <div className="pt-10">
              <Section num={8} title="Policy Changes">
                <P>
                  We will notify users of changes substantially affecting their rights via a prominent notice on the platform. The last updated date is always shown at the top of this page.
                </P>
              </Section>
            </div>

            {/* 09 */}
            <Section num={9} title="Contact">
              <P>
                For all questions regarding data processing or to exercise your rights:
              </P>
              <P>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Data Request — GDPR`}
                  className="font-semibold text-[var(--brand-primary)] hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                — subject: "Data Request — GDPR"
              </P>
              <P>
                Or via the{" "}
                <Link
                  href="/kontakt"
                  className="text-[var(--brand-primary)] hover:underline"
                >
                  contact page
                </Link>{" "}
                to send a structured request.
              </P>
            </Section>
          </>
        ) : (
          <>
            {/* 01 */}
            <Section num={1} title="Rukovalac podacima">
              <P>
                Rukovalac podacima je administrator platforme Shootermarkt.
              </P>
              <P>
                Kontakt za sva pitanja u vezi sa obradom podataka:{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-[var(--brand-primary)] hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </P>
            </Section>

            {/* 02 */}
            <div className="pt-10">
              <Section num={2} title="Podaci koji se obrađuju">
                <P>Shootermarkt obrađuje sledeće kategorije ličnih podataka:</P>
                <Ul
                  items={[
                    "Ime i prezime sportiste",
                    "Godina rođenja",
                    "Pol",
                    "Nacionalnost i zemlja zastupanja",
                    "Naziv kluba",
                    "Rezultati sa zvaničnih streljačkih takmičenja: disciplina, kvalifikacioni skor, rang, serije, eventualni finalni rezultat i rang",
                    "Fotografija (avatar)",
                  ]}
                />
                <P>
                  Napomena: platforma ne prikuplja posebne kategorije ličnih podataka u smislu
                  člana 17. ZZPL (podaci o zdravlju, biometrijskim karakteristikama i sl.).
                </P>
              </Section>
            </div>

            {/* 03 */}
            <div className="pt-10">
              <Section num={3} title="Svrha i pravni osnov obrade">
                <P>
                  <strong>Svrha:</strong> Praćenje i prikaz streljačkih profila, rangiranja i
                  istorije nastupa u cilju unapređenja transparentnosti i dostupnosti
                  streljačkih rezultata u Srbiji i svetu.
                </P>
                <P>
                  <strong>Pravni osnov:</strong> Obrada se vrši na osnovu <strong>legitimnog interesa</strong> rukovaoca (čl. 12. st. 1. tač. 6)
                  Zakona o zaštiti podataka o ličnosti — „Sl. glasnik RS", br. 87/2018), u
                  skladu sa čl. 6. st. 1. tač. f) Opšte uredbe o zaštiti podataka (GDPR
                  2016/679). Legitimni interes se sastoji u vođenju evidencije o javno
                  objavljenim rezultatima profesionalnih i registrovanih sportista koji su,
                  pristupanjem zvaničnim takmičenjima pod okriljem SSS-a i ISSF-a, prihvatili
                  da budu evidentirani u javnim dokumentima.
                </P>
                <P>
                  <strong>Balansni test:</strong> obrada se ograničava na podatke koji su već
                  objavljeni u zvaničnim dokumentima; ne obrađuju se osetljive kategorije
                  podataka; sportisti imaju pravo prigovora i brisanja.
                </P>
              </Section>
            </div>

            {/* 04 */}
            <div className="pt-10">
              <Section num={4} title="Ko ima pristup podacima">
                <P>Podacima pristupaju:</P>
                <Ul
                  items={[
                    "Administrator platforme — u svrhu unosa i korekcije podataka",
                    <>
                      <strong>Supabase Inc.</strong> (San Francisco, SAD) — pružalac usluge
                      baze podataka i autentifikacije, uz primenu standardnih ugovornih
                      klauzula EU; podaci se čuvaju na serverima u regionu Evropske unije
                      (Frankfurt)
                    </>,
                    <>
                      <strong>Vercel Inc.</strong> (San Francisco, SAD) — pružalac usluge
                      hostinga i isporuke web sadržaja putem edge mreže; primenjuju se
                      standardne ugovorne klauzule EU
                    </>,
                  ]}
                />
                <P>
                  Podaci se ne prodaju, ne ustupaju trećim stranama u komercijalne svrhu, ne
                  koriste za reklamno profilisanje niti za automatizovano donošenje odluka
                  koje proizvode pravne ili njima slične efekte po fizičko lice.
                </P>
              </Section>
            </div>

            {/* 05 */}
            <div className="pt-10">
              <Section num={5} title="Prava lica na koja se podaci odnose">
                <P>
                  U skladu sa Zakonom o zaštiti podataka o ličnosti (ZZPL) imate pravo da:
                </P>
                <Ul
                  items={[
                    "Pristupite podacima koji se o vama obrađuju",
                    "Zatražite ispravku netačnih ili dopunu nepotpunih podataka",
                    "Zatražite brisanje podataka („pravo na zaborav“) kada osnov za obradu prestane da postoji ili kada uložite prigovor koji pretegne nad legitimnim interesom",
                    "Ograničite obradu dok se vaš zahtev razmatra",
                    "Uložite prigovor na obradu zasnovanu na legitimnom interesu — u tom slučaju prestaćemo sa obradom osim ako ne dokažemo da postoje uvažljivi legitimni razlozi koji pretežu nad vašim interesima",
                  ]}
                />
                <P>
                  Zahtev pošaljite na{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Zahtev za podatke — ZZPL`}
                    className="font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>{" "}
                  sa oznakom „Zahtev za podatke — ZZPL". Odgovorićemo u roku od{" "}
                  <strong>30 dana</strong> od prijema zahteva (rok se može produžiti za još
                  60 dana u složenim slučajevima, uz obaveštenje).
                </P>
              </Section>
            </div>

            {/* 06 */}
            <div className="pt-10">
              <Section num={6} title="Rokovi čuvanja">
                <P>
                  Rezultati takmičenja i prateći lični podaci čuvaju se dok je platforma
                  aktivna, odnosno dok ne primimo zahtev za brisanje koji uvažimo.
                </P>
                <P>
                  U slučaju zatvaranja platforme, svi lični podaci biće trajno obrisani ili
                  anonimizovani u roku od <strong>90 dana</strong> od prestanka rada.
                </P>
                <P>
                  Anonimizovane agregatne statistike (bez vezivanja za identifikovano fizičko
                  lice) mogu biti zadržane u naučne ili istorijske svrhe.
                </P>
              </Section>
            </div>

            {/* 07 */}
            <div className="pt-10">
              <Section num={7} title="Kolačići i tehnički podaci">
                <P>
                  Shootermarkt koristi isključivo <strong>session kolačić</strong> koji
                  postavlja Supabase u svrhu autentifikacije administratorskog naloga. Kolačić
                  je tehnički neophodan i ne postavlja se posetiocima bez administratorske
                  uloge.
                </P>
                <P>Ne koristimo:</P>
                <Ul
                  items={[
                    "analitičke servise (Google Analytics, Plausible i sl.)",
                    "piksele za praćenje ili reklamne mreže",
                    "kolačiće treće strane",
                  ]}
                />
                <P>
                  Server logovi (IP adresa, User-Agent, vreme pristupa) koje automatski
                  generiše Vercel dostupni su privremeno u svrhu otklanjanja tehničkih grešaka
                  i bezbednosnog nadzora, a brišu se u skladu sa Vercelovom politikom
                  zadržavanja logova.
                </P>
              </Section>
            </div>

            {/* 08 */}
            <div className="pt-10">
              <Section num={8} title="Izmene politike">
                <P>
                  O izmenama koje suštinski utiču na prava korisnika obavestićemo istaknutim
                  obaveštenjem na platformi. Datum poslednjeg ažuriranja uvek je prikazan na
                  vrhu ove stranice. Preporučujemo povremenu proveru.
                </P>
              </Section>
            </div>

            {/* 09 */}
            <div className="pt-10">
              <Section num={9} title="Kontakt">
                <P>
                  Za sva pitanja u vezi sa obradom ličnih podataka ili radi ostvarivanja
                  vaših prava:
                </P>
                <P>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Zahtev za podatke — ZZPL`}
                    className="font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>{" "}
                  — predmet: „Zahtev za podatke — ZZPL"
                </P>
                <P>
                  Ili putem{" "}
                  <Link
                    href="/kontakt"
                    className="text-[var(--brand-primary)] hover:underline"
                  >
                    kontakt stranice
                  </Link>{" "}
                  za slanje strukturiranog zahteva.
                </P>
              </Section>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
