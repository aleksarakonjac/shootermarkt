import { NextRequest, NextResponse } from "next/server";
import { commitMixedTeamEntries, MixedCommitError, type MixedCommitInput } from "@/lib/import-commit-mixed";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await commitMixedTeamEntries((await req.json()) as MixedCommitInput));
  } catch (error) {
    if (error instanceof MixedCommitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Mixed-team import commit failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mixed-team commit failed" }, { status: 500 });
  }
}
