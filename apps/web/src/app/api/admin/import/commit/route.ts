import { NextRequest, NextResponse } from "next/server";
import { CommitValidationError, commitImportReview } from "@/lib/import-commit";
import type { CommitPayload } from "@shootermarkt/db/pdf-import-types";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await commitImportReview((await req.json()) as CommitPayload));
  } catch (error) {
    if (error instanceof CommitValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Result import commit failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Commit failed" }, { status: 500 });
  }
}

export const POST = revalidatesPublicSite(handlePOST);
