import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { shooters, clubs } from "@shootermarkt/db/schema";
import { eq, ilike, or, and } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q");
  const data = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      nationality: shooters.nationality,
      gender: shooters.gender,
      birthYear: shooters.birthYear,
      verified: shooters.verified,
      issfId: shooters.issfId,
      clubName: clubs.name,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(
      q
        ? and(
            ...q
              .split(/\s+/)
              .filter(Boolean)
              .map((word) =>
                or(ilike(shooters.firstName, `%${word}%`), ilike(shooters.lastName, `%${word}%`))
              )
          )
        : undefined
    )
    .orderBy(shooters.lastName);

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { firstName, lastName, nationality, gender, birthYear, birthDate, clubId, issfId } = body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: "Ime i prezime su obavezni" }, { status: 400 });
  }

  const [shooter] = await db
    .insert(shooters)
    .values({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nationality: nationality?.trim() || null,
      gender: gender || null,
      birthYear: birthDate
        ? new Date(birthDate).getFullYear()
        : birthYear ? parseInt(birthYear) : null,
      birthDate: birthDate || null,
      clubId: clubId ? parseInt(clubId) : null,
      issfId: issfId?.trim() || null,
      verified: false,
      createdBySelf: false,
    })
    .returning({ id: shooters.id });

  return NextResponse.json({ id: shooter.id });
}
