import { describe, expect, it } from "vitest";
import { findLinkedGroup } from "./linked-group";

const group = (key: string, date: string) => ({ key, code: key.split("@")[0], date });
const all = () => true;

describe("findLinkedGroup", () => {
  it("link bez meča (sa početne) vodi na zaseban meč kad nema glavnog", () => {
    expect(findLinkedGroup([group("APM@7", "2026-11-28")], "APM", all)?.key).toBe("APM@7");
  });
  it("više mečeva bez glavnog → najnoviji", () => {
    expect(findLinkedGroup([group("APM@7", "2026-11-27"), group("APM@8", "2026-11-28")], "APM", all)?.key).toBe("APM@8");
  });
  it("tačan ključ ima prednost", () => {
    const groups = [group("APM", "2026-11-27"), group("APM@8", "2026-11-28")];
    expect(findLinkedGroup(groups, "APM", all)?.key).toBe("APM");
    expect(findLinkedGroup(groups, "APM@8", all)?.key).toBe("APM@8");
  });
  it("preskače grupe bez tražene kategorije; nepostojeći meč ne pogađa ništa", () => {
    const groups = [group("APM", "2026-11-27"), group("APM@8", "2026-11-28")];
    expect(findLinkedGroup(groups, "APM", (g) => g.key === "APM@8")?.key).toBe("APM@8");
    expect(findLinkedGroup(groups, "APM@9", all)).toBeUndefined();
    expect(findLinkedGroup(groups, "ARM", all)).toBeUndefined();
  });
});
