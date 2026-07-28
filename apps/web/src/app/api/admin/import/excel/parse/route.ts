import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { clubs, shooters } from "@shootermarkt/db/schema";
import { parseExcelResultRows } from "@/lib/excel-results/parse";
import { matchShooter } from "@shootermarkt/db/name-match";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Izaberi .xlsx fajl." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Podržan je samo .xlsx fajl." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Excel fajl mora biti manji od 5 MB." }, { status: 400 });
  }

  let rawRows: Record<string, unknown>[];
  let headers: string[];
  try {
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets.Rezultati ?? workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("Nedostaje list Rezultati.");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    headers = (matrix[0] ?? []).map((value) => String(value).trim());
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  } catch (error) {
    return NextResponse.json({ error: `Excel fajl nije moguće pročitati: ${String(error)}` }, { status: 422 });
  }

  const parsed = parseExcelResultRows(rawRows, headers);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "Nema ispravnih redova za pregled.", errors: parsed.errors }, { status: 422 });
  }

  const [allClubs, allShooters] = await Promise.all([
    db.select().from(clubs),
    db.select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality }).from(shooters),
  ]);

  const rows = parsed.rows.map((row) => {
    const match = matchShooter(row.firstName, row.lastName, row.teamNoc || null, allShooters);
    const club = row.clubAbbr
      ? allClubs.find((candidate) =>
          candidate.nocCode?.toLowerCase() === row.clubAbbr?.toLowerCase() ||
          candidate.name.toLowerCase() === row.clubAbbr?.toLowerCase()
        )
      : undefined;
    const suggestedName = match.kind === "suggestion" ? match.name : undefined;
    const shooterId = match.kind === "exact" ? match.id : undefined;

    return {
      ...row,
      shooterId,
      isNew: !shooterId,
      suggestedShooterId: match.kind === "suggestion" ? match.id : undefined,
      suggestedName,
      clubId: club?.id,
      warning: shooterId
        ? undefined
        : suggestedName
          ? `Možda: ${suggestedName}`
          : "Novi strelac — biće kreiran",
    };
  });

  return NextResponse.json({
    rows,
    errors: parsed.errors,
    competitionId: parsed.competitionId,
    competition: parsed.competition,
  });
}
