import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";
import path from "path";
import { CmsUsers } from "./src/cms/collections/CmsUsers";
import { Media } from "./src/cms/collections/Media";
import { Articles } from "./src/cms/collections/Articles";

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  admin: {
    user: "cms-users",
  },
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL!,
    },
  }),
  collections: [CmsUsers, Media, Articles],
  sharp,
  typescript: {
    outputFile: path.resolve(__dirname, "src/payload-types.ts"),
  },
});
