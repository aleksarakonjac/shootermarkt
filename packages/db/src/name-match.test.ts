import { describe, expect, it } from "vitest";
import { matchShooter } from "./name-match";

const aleksandra = { id: 1, firstName: "Aleksandra", lastName: "Stojadinović", previousLastNames: ["Havran"] };

describe("matchShooter previous last names", () => {
  it("matches by current last name", () => {
    expect(matchShooter("Aleksandra", "Stojadinovic", "SRB", [aleksandra])).toEqual({ kind: "exact", id: 1 });
  });
  it("matches by previous last name", () => {
    expect(matchShooter("Aleksandra", "Havran", "SRB", [aleksandra])).toEqual({ kind: "exact", id: 1 });
  });
  it("does not match a different first name", () => {
    expect(matchShooter("Marija", "Havran", "SRB", [aleksandra]).kind).toBe("none");
  });
});
