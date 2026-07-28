import type { Block } from "payload";

export const CompetitionEmbedBlock: Block = {
  slug: "competition-embed",
  labels: { singular: "Rezultat/takmičenje", plural: "Rezultati/takmičenja" },
  fields: [
    {
      name: "competitionId",
      type: "number",
      required: true,
      admin: {
        description: "ID takmičenja iz sport-data baze (pretraga u UI-ju, Task 9).",
      },
    },
  ],
};
