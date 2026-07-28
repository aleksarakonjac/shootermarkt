import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSssBilteni } from "@/lib/sss/adapter";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bilteni = await fetchSssBilteni();
    return NextResponse.json(bilteni);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
