import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { KontaktForm } from "./KontaktForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact.metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

const CONTACT_EMAIL = "kontakt@shootermarkt.com";

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

export default async function KontaktPage() {
  const t = await getTranslations("contact");

  const items = [
    t("listItem1"),
    t("listItem2"),
    t("listItem3"),
    t("listItem4"),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          {t("title")}
        </h1>
        <p className="text-[0.9375rem] text-[var(--ink)] mt-3 leading-relaxed" style={{ textWrap: "pretty" } as React.CSSProperties}>
          {t("subtitle")}
        </p>
      </div>

      {/* Two sections */}
      <div className="space-y-8">

        {/* Contact form */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <h2
            className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] mb-1"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.01em" }}
          >
            {t("form.sectionTitle")}
          </h2>
          <p className="text-sm text-[var(--muted)] mb-6">{t("generalText")}</p>
          <KontaktForm />
        </div>

        {/* ZZPL data requests */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <h2
            className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] mb-1"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.01em" }}
          >
            {t("requestTitle")}
          </h2>
          <p className="text-xs text-[var(--muted)] mb-4 font-[family-name:var(--font-jetbrains-mono)]">
            {t("requestSubtitle")}
          </p>
          <div className="space-y-3 text-[0.9375rem] leading-relaxed text-[var(--ink)]">
            <p>
              {t("requestText")}
            </p>
            <p>
              <MailLink
                email={CONTACT_EMAIL}
                subject={t("requestSubject")}
                label={`${CONTACT_EMAIL} · ${t("requestLabel")}`}
              />
            </p>

            {/* What to include */}
            <div className="mt-4 p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <p className="text-sm font-semibold text-[var(--ink)] mb-2">
                {t("listTitle")}
              </p>
              <ol className="space-y-1.5 text-sm text-[var(--muted)]">
                {items.map((item, i) => (
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
              {t("requestTime")}
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-sm text-[var(--muted)] leading-relaxed" style={{ textWrap: "pretty" } as React.CSSProperties}>
          {t("footerNote")}{" "}
          <a href="/privatnost" className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
            {t("privacyPolicyLink")}
          </a>
          .
        </p>

      </div>
    </div>
  );
}
