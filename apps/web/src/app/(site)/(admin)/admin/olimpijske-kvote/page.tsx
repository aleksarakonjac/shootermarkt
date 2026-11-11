import { OtherQuotasManager } from "./other-quotas-manager";

export const metadata = { title: "Admin · Olimpijske kvote" };

export default function OlympicQuotasAdminPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold uppercase text-[var(--ink)]">Olimpijske kvote · LA 2028</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Kvote koje se ne osvajaju na takmičenju: olimpijska rang-lista, domaćin i univerzalna mesta. Unesi broj mesta po disciplini čim ga znaš, a strelca dodaj kad se sazna.
        Kvote sa takmičenja se unose na stranici takmičenja.
      </p>
      <OtherQuotasManager />
    </div>
  );
}
