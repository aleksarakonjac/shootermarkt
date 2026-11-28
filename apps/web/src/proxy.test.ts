import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// next-intl's ESM build does not resolve under vitest; only our own redirects are under test.
vi.mock("next-intl/middleware", () => ({ default: () => () => NextResponse.next() }));

const { proxy } = await import("./proxy");

async function location(url: string, cookie?: string) {
  const req = new NextRequest(url, { headers: cookie ? { cookie } : {} });
  const res = await proxy(req);
  return res.headers.get("location");
}

describe("proxy redirects keep the query string", () => {
  it("locale without scope → adds srb, keeps ?ref", async () => {
    expect(await location("https://shootermarkt.com/en?ref=flyer")).toBe(
      "https://shootermarkt.com/en/srb?ref=flyer",
    );
  });

  it("bare path with saved preference → keeps ?ref", async () => {
    expect(await location("https://shootermarkt.com/?ref=flyer", "pref_locale=sr; pref_scope=srb")).toBe(
      "https://shootermarkt.com/sr/srb?ref=flyer",
    );
  });

  it("flyer QR without a saved choice → Serbian", async () => {
    expect(await location("https://shootermarkt.com/?ref=flyer")).toBe(
      "https://shootermarkt.com/sr/srb?ref=flyer",
    );
  });

  it("flyer QR with a saved English choice → stays English", async () => {
    expect(await location("https://shootermarkt.com/?ref=flyer", "pref_locale=en")).toBe(
      "https://shootermarkt.com/en/srb?ref=flyer",
    );
  });
});
