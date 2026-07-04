import type { CollectionConfig } from "payload";
import { lexicalEditor } from "@payloadcms/richtext-lexical";

export const Articles: CollectionConfig = {
  slug: "articles",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "author", "publishedAt"],
  },
  access: {
    // Public/anonymous requests only ever see published articles.
    // Logged-in CMS users see everything (admin) so they can review drafts.
    read: ({ req }) => {
      if (req.user) return true;
      return { status: { equals: "published" } };
    },
    create: ({ req }) => !!req.user,
    update: ({ req }) => {
      if (!req.user) return false;
      if (req.user.role === "admin") return true;
      // authors can only update their own articles
      return { author: { equals: req.user.id } };
    },
    delete: ({ req }) => req.user?.role === "admin",
  },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "URL-friendly identifier, e.g. moj-clanak" },
    },
    { name: "excerpt", type: "textarea", required: true },
    {
      name: "content",
      type: "richText",
      editor: lexicalEditor({}),
      required: true,
    },
    {
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      required: true,
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "cms-users",
      required: true,
      defaultValue: ({ user }: { user?: { id: number } }) => user?.id,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "In Review", value: "in_review" },
        { label: "Published", value: "published" },
      ],
      access: {
        // Only admins may set status to "published". Authors can still
        // move between draft/in_review via the update hook validation below.
        update: ({ req }) => req.user?.role === "admin",
      },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: { position: "sidebar" },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Stamp publishedAt the first time status flips to "published".
        if (data.status === "published" && originalDoc?.status !== "published") {
          data.publishedAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },
};
