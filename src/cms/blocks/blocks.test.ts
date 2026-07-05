import { describe, it, expect } from "vitest";
import { CompetitionEmbedBlock } from "./CompetitionEmbedBlock";
import { ShooterEmbedBlock } from "./ShooterEmbedBlock";
import { GalleryBlock } from "./GalleryBlock";

describe("custom blocks", () => {
  it("CompetitionEmbedBlock has slug competition-embed and a competitionId number field", () => {
    expect(CompetitionEmbedBlock.slug).toBe("competition-embed");
    const field = CompetitionEmbedBlock.fields.find(
      (f) => "name" in f && f.name === "competitionId"
    );
    expect(field).toMatchObject({ name: "competitionId", type: "number", required: true });
  });

  it("ShooterEmbedBlock has slug shooter-embed and a shooterId number field", () => {
    expect(ShooterEmbedBlock.slug).toBe("shooter-embed");
    const field = ShooterEmbedBlock.fields.find(
      (f) => "name" in f && f.name === "shooterId"
    );
    expect(field).toMatchObject({ name: "shooterId", type: "number", required: true });
  });

  it("GalleryBlock has slug gallery and an images relationship field to media", () => {
    expect(GalleryBlock.slug).toBe("gallery");
    const field = GalleryBlock.fields.find((f) => "name" in f && f.name === "images");
    expect(field).toMatchObject({ name: "images", type: "relationship", relationTo: "media", hasMany: true });
  });
});
