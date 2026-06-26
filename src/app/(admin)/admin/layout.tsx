import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-56 shrink-0 px-4 py-6"
        style={{ borderRight: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.15em]"
          style={{ color: "var(--subtle)" }}
        >
          Admin
        </p>
        <nav className="mt-4 flex flex-col gap-0.5">
          {[
            { href: "/admin", label: "Pregled" },
            { href: "/admin/strelci", label: "Strelci" },
            { href: "/admin/strelci/novi", label: "  + Novi strelac" },
            { href: "/admin/strelci/issf", label: "  Bulk ISSF" },
            { href: "/admin/takmicenja", label: "Takmičenja" },
            { href: "/admin/takmicenja/novi", label: "  + Novo" },
            { href: "/admin/takmicenja/issf", label: "  Sync ISSF" },
            { href: "/admin/import", label: "PDF Import" },
            { href: "/admin/issf", label: "ISSF Rezultati" },
            { href: "/admin/sius", label: "SIUS Rezultati" },
            { href: "/admin/sss", label: "SSS Bilteni" },
            { href: "/admin/kalendar", label: "Kalendar" },
            { href: "/admin/obavestenja", label: "Obaveštenja" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium transition-colors"
              style={{ color: "var(--muted)" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
