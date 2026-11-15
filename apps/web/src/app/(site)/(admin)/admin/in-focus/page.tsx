import Link from "next/link";
import { getFocusPlan } from "@/lib/focus-plan";
import { DEFAULT_SCOPE, VALID_SCOPES, type Scope } from "@/lib/scope";
import { FocusAdminClient } from "./focus-client";

export const metadata = { title: "Admin · In focus" };
export const dynamic = "force-dynamic";

const SCOPE_LABEL: Record<Scope, string> = { srb: "Srbija", issf: "ISSF" };

export default async function AdminInFocusPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope: raw } = await searchParams;
  const scope: Scope = VALID_SCOPES.includes(raw as Scope) ? (raw as Scope) : DEFAULT_SCOPE;
  const plan = await getFocusPlan(scope);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold uppercase text-[var(--ink)]">In focus</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Takmičenja na vrhu početne. Ručni izbor uvek ima prednost; sve što ne diraš bira automatika po prioritetu.
        </p>
      </div>
      <div className="flex gap-1">
        {VALID_SCOPES.map((s) => (
          <Link
            key={s}
            href={`/admin/in-focus?scope=${s}`}
            className="px-4 py-1.5 rounded-md text-sm font-semibold no-underline"
            style={s === scope ? { background: "var(--ink)", color: "var(--bg)" } : { background: "var(--surface-2)", color: "var(--muted)" }}
          >
            {SCOPE_LABEL[s]}
          </Link>
        ))}
      </div>
      <FocusAdminClient key={scope} scope={scope} plan={plan} />
    </div>
  );
}
