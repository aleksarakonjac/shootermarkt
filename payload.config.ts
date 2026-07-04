import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";
import path from "path";

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
  collections: [],
  sharp,
  typescript: {
    outputFile: path.resolve(__dirname, "src/payload-types.ts"),
  },
});
