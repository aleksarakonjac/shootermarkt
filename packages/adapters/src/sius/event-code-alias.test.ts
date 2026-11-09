import { describe, expect, it } from "vitest";
import { canonicalSiusEventCode } from "./event-code-alias";

describe("canonicalSiusEventCode", () => {
  it("maps SIUS 300m codes to ours", () => {
    expect(canonicalSiusEventCode("300R3PM")).toBe("R3P300M");
    expect(canonicalSiusEventCode("300R3PW")).toBe("R3P300W");
    expect(canonicalSiusEventCode("300RPRM")).toBe("RPR300M");
    expect(canonicalSiusEventCode("300RPRW")).toBe("RPR300W");
    expect(canonicalSiusEventCode("300STR3PO")).toBe("STR300");
  });
  it("keeps the junior suffix", () => {
    expect(canonicalSiusEventCode("300RPRMJ")).toBe("RPR300MJ");
  });
  it("collapses numbered repeat events", () => {
    expect(canonicalSiusEventCode("R3PM2")).toBe("R3PM");
    expect(canonicalSiusEventCode("SPW1")).toBe("SPW");
    expect(canonicalSiusEventCode("300RPRW2")).toBe("RPR300W");
  });
  it("leaves everything else alone", () => {
    for (const c of ["ARM", "ARWJ", "R3PM", "10ARU18W", "ARM-ECH-SOLO", "R3PM-ECH-SOLO", "APMT", ""]) {
      expect(canonicalSiusEventCode(c)).toBe(c);
    }
  });
});
