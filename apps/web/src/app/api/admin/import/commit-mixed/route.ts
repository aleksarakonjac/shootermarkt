import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { commitMixedTeamEntries, MixedCommitError, type MixedCommitInput } from "@/lib/import-commit-mixed";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await commitMixedTeamEntries((await req.json()) as MixedCommitInput));
  } catch (error) {
    if (error instanceof MixedCommitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Mixed-team import commit failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mixed-team commit failed" }, { status: 500 });
  }
}
