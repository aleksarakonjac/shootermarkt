import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchSssBilteni } from "@/lib/sss/adapter";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const bilteni = await fetchSssBilteni();
    return NextResponse.json(bilteni);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
