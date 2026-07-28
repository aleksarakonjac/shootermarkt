import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Sync PDF parsiranje je ukinuto. Koristi /api/admin/import/jobs." },
    { status: 410 }
  );
}
