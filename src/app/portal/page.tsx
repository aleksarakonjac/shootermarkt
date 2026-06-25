import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Moj profil" };

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shooter = await db.query.shooters.findFirst({
    where: eq(shooters.supabaseUserId, user.id),
    with: { club: true },
  });

  if (!shooter) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Dobrodošao!</h1>
        <p className="mt-2 text-zinc-500">
          Tvoj nalog je kreiran. Admin će ti kreirati profil strelca ili možeš
          zatražiti da povežemo tvoj nalog sa postojećim profilom.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Prijavljen kao: {user.email}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Moj profil</h1>
        {shooter.verified ? (
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
            Verifikovan
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
            Čeka verifikaciju
          </span>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 divide-y divide-zinc-100">
        {[
          { label: "Ime", value: `${shooter.firstName} ${shooter.lastName}` },
          { label: "Klub", value: shooter.club?.name ?? "—" },
          { label: "Godina rođenja", value: shooter.birthYear ?? "—" },
          { label: "Licenca", value: shooter.licenseNumber ?? "—" },
        ].map((row) => (
          <div key={row.label} className="flex justify-between px-5 py-3 text-sm">
            <span className="text-zinc-500">{row.label}</span>
            <span className="font-medium text-zinc-900">{row.value}</span>
          </div>
        ))}
      </div>

      {!shooter.verified && (
        <p className="mt-4 text-sm text-zinc-500">
          Admin proverava identitet pre nego što se profil objavi na sajtu.
        </p>
      )}
    </div>
  );
}
