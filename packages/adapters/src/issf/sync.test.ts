import { describe, expect, it, vi } from "vitest";

vi.mock("@shootermarkt/db", () => ({ db: {} }));
vi.mock("@shootermarkt/db/upload-avatar-raw", () => ({ NoAvatarError: class extends Error {}, uploadAvatarFromUrlRaw: vi.fn() }));

const { issfAscii, rankMatch } = await import("./sync");

describe("issfAscii", () => {
  it("strips Serbian diacritics the way ISSF stores names", () => {
    expect(issfAscii("Đorđević")).toBe("Dordevic");
    expect(issfAscii("Čučković Šćepan")).toBe("Cuckovic Scepan");
  });
});

describe("rankMatch", () => {
  const issf = (firstName: string, familyName: string) => ({ firstName, familyName });

  it("exact across đ/dj/d and case", () => {
    expect(rankMatch("Đorđe", "Đorđević", issf("Dorde", "DORDEVIC"))).toBe("exact");
    expect(rankMatch("Djordje", "Djordjevic", issf("Dorde", "DORDEVIC"))).toBe("exact");
  });

  it("close on small first-name typo or short form", () => {
    expect(rankMatch("Aleksa", "Rakonjac", issf("Aleksaa", "RAKONJAC"))).toBe("close");
    expect(rankMatch("Ana", "Petrović", issf("Ana Marija", "PETROVIC"))).toBe("close");
  });

  it("weak when last name differs or first name is someone else", () => {
    expect(rankMatch("Aleksa", "Rakonjac", issf("Aleksa", "RAKIC"))).toBe("weak");
    expect(rankMatch("Aleksa", "Rakonjac", issf("Radomir", "RAKONJAC"))).toBe("weak");
  });
});
