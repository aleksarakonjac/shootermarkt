import { describe, expect, it } from "vitest";
import { matchedPreviousLastName } from "./previous-last-name";

describe("matchedPreviousLastName", () => {
  const args: [string, string, string[]] = ["Aleksandra", "Stojadinović", ["Havran"]];
  it("returns the old name when the query hit only it", () => {
    expect(matchedPreviousLastName("havran", ...args)).toBe("Havran");
    expect(matchedPreviousLastName("aleksandra havr", ...args)).toBe("Havran");
  });
  it("returns null when the query hit the current name or first name", () => {
    expect(matchedPreviousLastName("stojadinovic", ...args)).toBeNull();
    expect(matchedPreviousLastName("aleksandra", ...args)).toBeNull();
  });
  it("returns null without previous names", () => {
    expect(matchedPreviousLastName("havran", "A", "B", null)).toBeNull();
  });
});
