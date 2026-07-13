import { describe, expect, it } from "vitest";
import { mergeFinalsIntoRows, type ParsedEvent, type ReviewRow } from "./types";

const foldName = (value: string) => value.toLowerCase();

describe("mergeFinalsIntoRows", () => {
  it("stores final score and rank separately from qualification", () => {
    const rows: ReviewRow[] = [{
      firstName: "Marko",
      lastName: "Petrović",
      teamNoc: "SRB",
      disciplineCode: "ARM",
      category: "senior",
      qualTotal: 628.4,
      qualRank: 3,
      qualified: true,
    }];
    const events: ParsedEvent[] = [{
      discipline: "ARM",
      stage: "final",
      category: "senior",
      results: [{ rank: 1, firstName: "Marko", lastName: "Petrović", teamNoc: "SRB", total: 251.2 }],
    }];

    const result = mergeFinalsIntoRows(rows, events, foldName);

    expect(result).toMatchObject({ matchedFinals: 1, unmatchedFinals: 0 });
    expect(rows[0]).toMatchObject({ qualTotal: 628.4, qualRank: 3, finalTotal: 251.2, finalRank: 1 });
  });

  it("matches a final even when Gemini assigns a different age category", () => {
    const rows: ReviewRow[] = [{
      firstName: "Ana",
      lastName: "Jovanović",
      teamNoc: "SRB",
      disciplineCode: "ARW",
      category: "junior",
      qualTotal: 625.8,
    }];
    const events: ParsedEvent[] = [{
      discipline: "ARW",
      stage: "final",
      category: "senior",
      results: [{ rank: 2, firstName: "Ana", lastName: "Jovanović", teamNoc: "SRB", total: 248.6 }],
    }];

    const result = mergeFinalsIntoRows(rows, events, foldName);

    expect(result).toMatchObject({ matchedFinals: 1, unmatchedFinals: 0 });
    expect(rows[0]).toMatchObject({ finalTotal: 248.6, finalRank: 2, qualified: true });
  });

  it("preserves granular final data when the bulletin provides it", () => {
    const rows: ReviewRow[] = [{
      firstName: "Ana", lastName: "Ilić", teamNoc: "SRB", disciplineCode: "ARW",
      category: "senior", qualTotal: 627.2,
    }];
    const events: ParsedEvent[] = [{
      discipline: "ARW", stage: "final", category: "senior", results: [{
        rank: 1, lastName: "Ilić", firstName: "Ana", teamNoc: "SRB", total: 252.4,
        series: [104.8, 105.2], shots: [10.5, 10.7, 10.3], cumulative: [52.1, 104.8, 157.6, 210.3, 252.4],
      }],
    }];

    mergeFinalsIntoRows(rows, events, foldName);

    expect(rows[0]).toMatchObject({
      finalTotal: 252.4,
      finalSeries: [104.8, 105.2],
      finalShots: [10.5, 10.7, 10.3],
      finalCumulative: [52.1, 104.8, 157.6, 210.3, 252.4],
      finalScoring: "decimal",
    });
  });

  it("marks Sport Pistol finals as hit-count scoring", () => {
    const rows: ReviewRow[] = [{
      firstName: "Jelena", lastName: "Marković", teamNoc: "SRB", disciplineCode: "SPW",
      category: "senior", qualTotal: 574,
    }];
    const events: ParsedEvent[] = [{
      discipline: "SPW", stage: "final", category: "senior", results: [{
        rank: 1, lastName: "Marković", firstName: "Jelena", teamNoc: "SRB", total: 22,
        series: [4, 3, 5], cumulative: [14, 17, 22],
      }],
    }];

    mergeFinalsIntoRows(rows, events, foldName);

    expect(rows[0]).toMatchObject({
      finalTotal: 22,
      finalSeries: [4, 3, 5],
      finalCumulative: [14, 17, 22],
      finalScoring: "hit_count",
    });
  });

  it("preserves MK final phase labels and only its elimination shots", () => {
    const rows: ReviewRow[] = [{
      firstName: "Nikola", lastName: "Kovačević", teamNoc: "SRB", disciplineCode: "R3PM",
      category: "senior", qualTotal: 1172,
    }];
    const events: ParsedEvent[] = [{
      discipline: "R3PM", stage: "final", category: "senior", results: [{
        rank: 2, lastName: "Kovačević", firstName: "Nikola", teamNoc: "SRB", total: 458.6,
        series: [101.4, 104.2, 51.7, 52.0],
        seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2"],
        shots: [10.4, 10.7, 10.1], cumulative: [319.3, 371.0, 423.0, 458.6],
      }],
    }];

    mergeFinalsIntoRows(rows, events, foldName);

    expect(rows[0]).toMatchObject({
      finalSeries: [101.4, 104.2, 51.7, 52.0],
      finalSeriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2"],
      finalShots: [10.4, 10.7, 10.1],
    });
  });
});
