import { redirect } from "next/navigation";
import type { Scope } from "@/lib/scope";

export default async function ScopedKalendarPage({
  params,
}: {
  params: Promise<{ scope: Scope }>;
}) {
  const { scope } = await params;
  redirect(`/${scope}/takmicenja?view=cal`);
}
