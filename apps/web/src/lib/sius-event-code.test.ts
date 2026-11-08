import { describe, expect, it } from "vitest";
import { siusEventCodes } from "./sius-event-code";

describe("siusEventCodes", () => {
  it("keeps senior codes and adds J for junior events", () => {
    expect(siusEventCodes("ARW", "senior")).toEqual(["ARW"]);
    expect(siusEventCodes("STR300", "open")).toEqual(["STR300"]);
    expect(siusEventCodes("ARW", "junior")).toEqual(["ARWJ"]);
    expect(siusEventCodes("APMT", "junior")).toEqual(["APMTJ"]);
  });

  it("maps 10m youth categories to the European U16/U18 event codes", () => {
    expect(siusEventCodes("ARW", "mladji_junior")).toEqual(["10ARU18W", "ARWJ"]);
    expect(siusEventCodes("APM", "kadet")).toEqual(["10APU16M"]);
  });

  it("returns no codes for categories SIUS has no own event for, instead of the senior event", () => {
    expect(siusEventCodes("R3PM", "kadet")).toEqual([]);
    expect(siusEventCodes("R3PW", "mladji_junior")).toEqual([]);
    expect(siusEventCodes("ARM", "pionir")).toEqual([]);
    expect(siusEventCodes("APW", "master")).toEqual([]);
    expect(siusEventCodes("ARM", "mladji_senior")).toEqual([]);
  });
});
