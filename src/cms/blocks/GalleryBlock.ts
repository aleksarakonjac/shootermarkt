import type { Block } from "payload";

export const GalleryBlock: Block = {
  slug: "gallery",
  labels: { singular: "Galerija slika", plural: "Galerije slika" },
  fields: [
    {
      name: "images",
      type: "relationship",
      relationTo: "media",
      hasMany: true,
      required: true,
      minRows: 2,
    },
  ],
};
