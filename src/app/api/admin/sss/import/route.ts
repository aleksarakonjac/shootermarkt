import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfWithGemini } from "@/lib/pdf-import/gemini-adapter";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { DISCIPLINE_META, IMPORTED_DISCIPLINE_CODES, dedupeRowsByCategory, type ReviewRow } from "@/lib/pdf-import/types";
import { matchShooter, foldName } from "@/lib/name-match";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { url, filename } = body as { url: string; filename: string };

  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Validate URL — only allow HTTPS from known SSS domain
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  const ALLOWED_HOSTS = ["serbianshooting.rs", "www.serbianshooting.rs"];
  if (parsedUrl.protocol !== "https:" || !ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    return NextResponse.json({ error: "URL mora biti sa serbianshooting.rs (HTTPS)" }, { status: 400 });
  }

  // Download PDF
  let pdfBuffer: Buffer;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pdfBuffer = Buffer.from(await res.arrayBuffer());
    if (pdfBuffer.byteLength < 100) throw new Error("Empty PDF");
  } catch (e) {
    return NextResponse.json({ error: `PDF download failed: ${e}` }, { status: 502 });
  }

  // Parse with Gemini
  let bilten;
  try {
    bilten = await parsePdfWithGemini(pdfBuffer);
  } catch (e) {
    return NextResponse.json({ error: `Gemini parse failed: ${e}` }, { status: 422 });
  }

  const mvpEvents = bilten.events.filter(
    (e) => IMPORTED_DISCIPLINE_CODES.includes(e.discipline) && e.stage === "qualification"
  );

  if (mvpEvents.length === 0) {
    return NextResponse.json(
      { error: "Nema kvalifikacionih tabela za discipline koje uvozimo (ARM/ARW/APM/APW/R3PM/R3PW/SPW)" },
      { status: 422 }
    );
  }

  const [allClubs, allShooters] = await Promise.all([
    db.select().from(clubs),
    db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
      .from(shooters),
  ]);

  const rows: ReviewRow[] = [];

  for (const event of mvpEvents) {
    const disciplineCode = event.discipline as ReviewRow["disciplineCode"];

    for (const result of event.results as Array<{
      rank: number;
      lastName: string;
      firstName: string;
      teamNoc: string;
      clubName?: string;
      birthYear?: number | null;
      series: number[];
      total: number;
      inners?: number | null;
      qualified?: boolean | null;
    }>) {
      const match = matchShooter(result.firstName, result.lastName, result.teamNoc || "SRB", allShooters);
      const matchedShooterId = match.kind === "exact" ? match.id : undefined;

      const matchedClub = result.clubName
        ? allClubs.find(
            (c) =>
              c.nocCode?.toLowerCase() === result.clubName?.toLowerCase() ||
              c.name.toLowerCase().includes(result.clubName!.toLowerCase())
          )
        : undefined;

      const meta = DISCIPLINE_META[disciplineCode];
      rows.push({
        shooterId: matchedShooterId,
        isNew: !matchedShooterId,
        suggestedShooterId: match.kind === "suggestion" ? match.id : undefined,
        suggestedName: match.kind === "suggestion" ? match.name : undefined,
        firstName: result.firstName,
        lastName: result.lastName,
        teamNoc: result.teamNoc || "SRB",
        birthYear: result.birthYear ?? null,
        gender: meta?.gender,
        apparatus: meta?.apparatus,
        clubAbbr: result.clubName,
        clubId: matchedClub?.id,
        disciplineCode,
        category: event.category,
        qualTotal: result.total,
        qualInners: result.inners,
        qualRank: result.rank,
        qualSeries: result.series,
        qualified: result.qualified,
        finalTotal: null,
        finalRank: null,
        warning: matchedShooterId
          ? undefined
          : match.kind === "suggestion"
          ? `Možda: ${match.name}`
          : "Novi strelac — biće kreiran",
      });
    }
  }

  const deduped = dedupeRowsByCategory(rows, foldName);
  return NextResponse.json({ rows: deduped, eventCount: mvpEvents.length, filename });
}
