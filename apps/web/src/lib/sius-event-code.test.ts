import { describe, expect, it } from "vitest";
import { siusEventCode } from "./sius-event-code";

describe("siusEventCode", () => {
  it("keeps senior codes and adds J for junior events", () => {
    expect(siusEventCode("ARW", "senior")).toBe("ARW");
    expect(siusEventCode("ARW", "junior")).toBe("ARWJ");
    expect(siusEventCode("APMT", "junior")).toBe("APMTJ");
  });

  it("maps 10m youth categories to the European U16/U18 event codes", () => {
    expect(siusEventCode("ARW", "mladji_junior")).toBe("10ARU18W");
    expect(siusEventCode("APM", "kadet")).toBe("10APU16M");
  });
});
