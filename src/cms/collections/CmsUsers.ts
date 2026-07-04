import type { CollectionConfig } from "payload";

export const CmsUsers: CollectionConfig = {
  slug: "cms-users",
  auth: true,
  admin: {
    useAsTitle: "email",
  },
  access: {
    // Only logged-in CMS users can see the user list; anyone with admin
    // access can read, only admins can create/update/delete other users.
    read: ({ req }) => !!req.user,
    create: ({ req }) => req.user?.role === "admin",
    update: ({ req }) => req.user?.role === "admin",
    delete: ({ req }) => req.user?.role === "admin",
  },
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "author",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Author", value: "author" },
      ],
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
  ],
};
