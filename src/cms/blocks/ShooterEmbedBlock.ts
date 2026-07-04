import type { Block } from "payload";

export const ShooterEmbedBlock: Block = {
  slug: "shooter-embed",
  labels: { singular: "Profil strelca", plural: "Profili strelaca" },
  fields: [
    {
      name: "shooterId",
      type: "number",
      required: true,
      admin: {
        description: "ID strelca iz sport-data baze (pretraga u UI-ju, Task 9).",
      },
    },
  ],
};
