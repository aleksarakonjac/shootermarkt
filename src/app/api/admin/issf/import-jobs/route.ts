import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queueIssfImportJob } from "@/lib/issf/jobs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await queueIssfImportJob(), { status: 202 });
  } catch {
    return NextResponse.json({ error: "Pokretanje ISSF importa nije uspelo" }, { status: 500 });
  }
}
