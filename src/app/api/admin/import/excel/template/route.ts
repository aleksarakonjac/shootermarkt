import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createResultsTemplate } from "@/lib/excel-results/template";

export const runtime = "nodejs";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new NextResponse(createResultsTemplate(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=shootermarkt-rezultati-sablon.xlsx",
      "Cache-Control": "no-store",
    },
  });
}
