import { NextResponse } from "next/server";
import { createResultsTemplate } from "@/lib/excel-results/template";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const template = createResultsTemplate();
  const body = new ArrayBuffer(template.byteLength);
  new Uint8Array(body).set(template);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=shootermarkt-rezultati-sablon.xlsx",
      "Cache-Control": "no-store",
    },
  });
}
