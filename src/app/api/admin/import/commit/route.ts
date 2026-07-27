import { NextRequest, NextResponse } from "next/server";
import { CommitValidationError, commitImportReview } from "@/lib/import-commit";
import type { CommitPayload } from "@/lib/pdf-import/types";
import { createClient } from "@/lib/supabase/server";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
