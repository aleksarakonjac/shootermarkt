import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queuePdfImportJob } from "@/lib/pdf-import/jobs";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, filename, competitionId, tags } = await req.json() as {
    url?: string;
    filename?: string;
    competitionId?: number;
    tags?: string[];
  };
  const normalizedCompetitionId = Number(competitionId);
  if (!url || !Number.isInteger(normalizedCompetitionId) || normalizedCompetitionId < 1) {
    return NextResponse.json({ error: "Izaberi SSS bilten i takmičenje" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Neispravan URL biltena" }, { status: 400 });
  }
  const allowedHosts = ["serbianshooting.rs", "www.serbianshooting.rs"];
  if (parsedUrl.protocol !== "https:" || !allowedHosts.includes(parsedUrl.hostname)) {
    return NextResponse.json({ error: "Bilten mora biti HTTPS PDF sa serbianshooting.rs" }, { status: 400 });
  }

  try {
    const job = await queuePdfImportJob({
      competitionId: normalizedCompetitionId,
      sourceUrl: parsedUrl.toString(),
      sourceLabel: filename?.trim() || "SSS bilten",
      tags: ["sss", ...(tags ?? [])],
    });
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    return NextResponse.json({
      error: `Pokretanje SSS importa nije uspelo: ${error instanceof Error ? error.message : String(error)}`,
    }, { status: 502 });
  }
}
