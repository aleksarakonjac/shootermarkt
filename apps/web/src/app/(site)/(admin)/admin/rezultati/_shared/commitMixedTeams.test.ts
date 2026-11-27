import { describe, expect, it } from "vitest";
import type { MixedTeamEntry } from "@shootermarkt/db/pdf-import-types";
import { commitMixedStages } from "./commitMixedTeams";

const team = (over: Partial<MixedTeamEntry>): MixedTeamEntry => ({
  skip: false, nocCode: "SRB", teamNumber: 1, disciplineCode: "APMT", qualRank: 1, qualTotal: 572, inners: 21, qualified: true,
  finalRank: 1, finalTotal: 475.7, mIssfId: null, mLastName: "Mikec", mFirstName: "Damir", m_series: [], mInners: null, mTotal: 0,
  fIssfId: null, fLastName: "Mikec", fFirstName: "Tea", f_series: [], fInners: null, fTotal: 0, ...over,
});

describe("commitMixedStages", () => {
  it("commits every match of a discipline separately, carrying its name and date", async () => {
    const calls: Array<{ isFinals: boolean; eventName?: string | null; eventDate?: string | null }> = [];
    await commitMixedStages([
      team({}),
      team({ eventName: "Salona Trophy 2026 · mešoviti timovi", eventDate: "2026-10-23" }),
    ], async (input) => {
      calls.push({ isFinals: input.isFinals, eventName: input.eventName, eventDate: input.eventDate });
      return { written: ["SRB#1"] };
    });
    expect(calls).toEqual([
      { isFinals: false, eventName: null, eventDate: null },
      { isFinals: true, eventName: null, eventDate: null },
      { isFinals: false, eventName: "Salona Trophy 2026 · mešoviti timovi", eventDate: "2026-10-23" },
      { isFinals: true, eventName: "Salona Trophy 2026 · mešoviti timovi", eventDate: "2026-10-23" },
    ]);
  });
});
