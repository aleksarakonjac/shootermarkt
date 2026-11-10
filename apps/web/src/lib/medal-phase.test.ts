import { describe, expect, it } from "vitest";
import { medalStage } from "./medal-phase";

const done = { isLive: false, hasResults: true };
const live = { isLive: true, hasResults: true };
const base = { level: "national", competitionOver: false, finalScheduled: false };

describe("medalStage", () => {
  it("finale gotovo → medalje samo u finalu", () => {
    expect(medalStage({ ...base, discCode: "ARM", finalScheduled: true, final: done, qual: done })).toBe("final");
  });
  it("finale u toku ili tek zakazano → bez medalja, ni u kvalifikacijama", () => {
    expect(medalStage({ ...base, discCode: "ARM", finalScheduled: true, final: live, qual: done })).toBeNull();
    expect(medalStage({ ...base, discCode: "ARM", finalScheduled: true, qual: done })).toBeNull();
  });
  it("disciplina bez finala (ležeći, 300m): medalje posle kvalifikacija", () => {
    expect(medalStage({ ...base, discCode: "RPRM", qual: done })).toBe("qual");
    expect(medalStage({ ...base, discCode: "R3P300M", qual: done })).toBe("qual");
    expect(medalStage({ ...base, discCode: "RPRM", qual: live })).toBeNull();
  });
  it("domaće takmičenje bez finala: medalje tek kad je završeno", () => {
    expect(medalStage({ ...base, discCode: "ARM", qual: done })).toBeNull();
    expect(medalStage({ ...base, discCode: "ARM", competitionOver: true, qual: done })).toBe("qual");
  });
  it("međunarodno bez finala u bazi: bez medalja", () => {
    expect(medalStage({ ...base, discCode: "ARM", level: "world", competitionOver: true, qual: done })).toBeNull();
  });
  it("samo elim → nikad medalje", () => {
    expect(medalStage({ ...base, discCode: "R3P300M", competitionOver: true })).toBeNull();
  });
});
