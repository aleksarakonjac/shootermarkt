import { describe, expect, it, vi } from "vitest";

vi.mock("@shootermarkt/db", () => ({ db: {} }));
vi.mock("@shootermarkt/db/upload-avatar-raw", () => ({ NoAvatarError: class extends Error {}, uploadAvatarFromUrlRaw: vi.fn() }));

const { issfAscii, rankMatch, renamedAlias } = await import("./sync");

describe("renamedAlias", () => {
  it("keeps a genuinely new ISSF last name, not a respelling", () => {
    const s = (firstName: string, lastName: string, previousLastNames: string[] | null = null) => ({ firstName, lastName, previousLastNames });
    expect(renamedAlias(s("Aleksandra", "Havran"), "STOJADINOVIC")).toBe("STOJADINOVIC");
    expect(renamedAlias(s("Aleksandra", "Havran", ["STOJADINOVIC"]), "STOJADINOVIC")).toBeNull();
    expect(renamedAlias(s("Emely", "JÄGGI"), "JAEGGI")).toBeNull();
    expect(renamedAlias(s("Đorđe", "Đorđević"), "DORDEVIC")).toBeNull();
    expect(renamedAlias(s("Mohammed", "Al-Harbi"), "AL HARBI")).toBeNull();
    expect(renamedAlias(s("Prodiashvili", "SALOME"), "PRODIASHVILI")).toBeNull();
    expect(renamedAlias(s("Aleksandra", "Havran"), "")).toBeNull();
  });
});

describe("issfAscii", () => {
  it("strips Serbian diacritics the way ISSF stores names", () => {
    expect(issfAscii("Đorđević")).toBe("Dordevic");
    expect(issfAscii("Čučković Šćepan")).toBe("Cuckovic Scepan");
  });

  it("maps letters NFD does not decompose", () => {
    expect(issfAscii("Hajı")).toBe("Haji");
    expect(issfAscii("GLEIßNER").toUpperCase()).toBe("GLEISSNER"); // ISSF pretraga ne gleda veličinu slova
    expect(issfAscii("ŚWIERGAŁA")).toBe("SWIERGALA");
    expect(issfAscii("ÇİZMECİOĞLU")).toBe("CIZMECIOGLU");
  });

  it("german transliteration only when asked", () => {
    expect(issfAscii("JÄGGI")).toBe("JAGGI");
    expect(issfAscii("JÄGGI", true)).toBe("JAEGGI");
    expect(issfAscii("Möllerstedt", true)).toBe("Moellerstedt");
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

  it("multi-word names split differently between source and ISSF", () => {
    expect(rankMatch("Mohammed", "Al-Harbi", issf("Mohammed Al", "Harbi"))).toBe("exact");
    expect(rankMatch("Mohammed", "Al Harbi", issf("Mohammed", "Alharbi"))).toBe("exact");
    expect(rankMatch("Mohammed", "Al-Harbi", issf("Mohammed Ali", "Al Harbi"))).toBe("close");
    expect(rankMatch("Mohammed", "Al-Harbi", issf("Ahmed", "Al Mutairi"))).toBe("weak");
  });

  it("exact against both umlaut spellings ISSF uses", () => {
    expect(rankMatch("Emely", "JÄGGI", issf("Emely", "JAEGGI"))).toBe("exact");
    expect(rankMatch("Daniel", "BÜHLMEYER", issf("Daniel", "BUEHLMEYER"))).toBe("exact");
    expect(rankMatch("Ferenc", "TÖRÖK", issf("Ferenc", "TOEROEK"))).toBe("exact");
    expect(rankMatch("Zoltán", "TÖRÖK", issf("Zoltan", "TOROK"))).toBe("exact");
    expect(rankMatch("Hajı", "MUSAYEV", issf("Haji", "MUSAYEV"))).toBe("exact");
    expect(rankMatch("Vanessa", "GLEIßNER", issf("Vanessa Alexandra", "GLEISSNER"))).toBe("close");
  });

  it("renamed: ISSF found by old last name returns the new one", () => {
    expect(rankMatch("Aleksandra", "Havran", issf("Aleksandra", "STOJADINOVIC"), true)).toBe("exact");
    expect(rankMatch("Vivien", "Havran", issf("Vivien Joy", "STOJADINOVIC"), true)).toBe("close");
    expect(rankMatch("Aleksandra", "Havran", issf("Milica", "STOJADINOVIC"), true)).toBe("weak");
    // samo kada je kandidat došao iz upita po prezimenu
    expect(rankMatch("Aleksandra", "Havran", issf("Aleksandra", "STOJADINOVIC"))).toBe("weak");
    // prezime je u imenu kandidata → ISSF ga je našao po imenu, ne po ranijem prezimenu
    expect(rankMatch("Aleksandra", "Havran", issf("Aleksandra", "HAVRANEK"), true)).toBe("weak");
  });

  it("weak when last name differs or first name is someone else", () => {
    expect(rankMatch("Aleksa", "Rakonjac", issf("Aleksa", "RAKIC"))).toBe("weak");
    expect(rankMatch("Aleksa", "Rakonjac", issf("Radomir", "RAKONJAC"))).toBe("weak");
  });
});
