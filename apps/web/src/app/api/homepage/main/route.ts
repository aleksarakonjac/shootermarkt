import { getHomepageMain } from "@/lib/homepage-data";
import { DEFAULT_SCOPE, type Scope, VALID_SCOPES } from "@/lib/scope";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestedScope = request.nextUrl.searchParams.get("scope");
  const scope: Scope = VALID_SCOPES.includes(requestedScope as Scope) ? requestedScope as Scope : DEFAULT_SCOPE;
  const startedAt = performance.now();
  const data = await getHomepageMain(scope);
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", "Server-Timing": `homepage-main-db;dur=${(performance.now() - startedAt).toFixed(1)}` } });
}
