import { afterEach, describe, expect, it, vi } from "vitest";
import { searchAthletes } from "./adapter";

afterEach(() => vi.unstubAllGlobals());

describe("searchAthletes", () => {
  it("limits capped-name pagination to eight concurrent ISSF requests", async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
      const capped = url.endsWith("search=SRB");
      return new Response(JSON.stringify(capped ? Array.from({ length: 300 }, (_, i) => ({ issfId: String(i) })) : []));
    }));

    await searchAthletes("SRB");

    expect(peak).toBe(8);
  });
});
