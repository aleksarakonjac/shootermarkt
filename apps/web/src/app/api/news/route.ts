import { getPublishedArticles } from "@/lib/cms/get-articles";
import { NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET() {
  try {
    const articles = await getPublishedArticles({ limit: 4 });
    return NextResponse.json(articles, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json([], { status: 503 });
  }
}
