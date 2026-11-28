import { describe, expect, it } from "vitest";
import { displayNoc, nocsShownAs } from "./noc-list";

describe("neutral status display", () => {
  it("shows Russian and Belarusian shooters as AIN, also inside a mixed pair", () => {
    expect(["RUS", "BLR", "SRB", "HUN/BLR", null].map(displayNoc)).toEqual(["AIN", "AIN", "SRB", "HUN/AIN", null]);
  });

  it("filters AIN over every stored code shown as AIN", () => {
    expect(nocsShownAs("AIN")).toEqual(["AIN", "RUS", "BLR", "URS"]);
    expect(nocsShownAs("RUS")).toEqual(nocsShownAs("AIN"));
    expect(nocsShownAs("SRB")).toEqual(["SRB"]);
  });
});
