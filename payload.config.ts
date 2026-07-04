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
  routes: {
    // Payload's RootPage reconstructs the current URL as
    // `routes.admin + "/" + segments`, independent of actual Next.js
    // folder nesting — it expects the admin catch-all folder to be
    // physically located AT this exact path. The folder lives at
    // src/app/(payload)/cms/admin/[[...segments]], matching "/cms/admin"
    // here exactly (mirroring how cms/api/[...slug] matches routes.api
    // below). An earlier attempt with this set to "/cms/admin" while the
    // folder was still at cms/[[...segments]] (one level shallower)
    // caused a duplicated "/cms/admin/admin/login" redirect loop.
    admin: "/cms/admin",
    api: "/cms/api",
  },
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL!,
    },
    // Without this, drizzle-kit's dev-mode schema push introspects the
    // ENTIRE shared Postgres database (all of Drizzle's ~15+ tables too)
    // and, since those tables aren't in Payload's own schema, proposes
    // DROPPING them to make the database match. Scoping tablesFilter to
    // only Payload-owned tables makes push ignore everything else in the
    // database entirely. Update this list whenever a new Payload
    // collection/block is added (e.g. Task 6's blocks may add
    // "articles_blocks_*" join tables).
    tablesFilter: ["payload_*", "cms_users", "media", "articles"],
    // Schema was pushed once (2026-07-04) and all Payload-owned tables
    // now exist. Disabling further auto-push: on every fresh dev-server
    // process, Payload's in-memory "did I already push this" cache resets
    // to empty, so it re-attempts a blind CREATE TABLE and collides with
    // tables that already correctly exist ("relation already exists").
    // Matches the project's existing convention of explicit migrations
    // rather than implicit dev-mode schema sync. When Task 6 adds new
    // fields/blocks, temporarily re-enable push (or run a real migration)
    // to apply the change once, then disable again.
    push: false,
  }),
  collections: [CmsUsers, Media, Articles],
  sharp,
  typescript: {
    outputFile: path.resolve(__dirname, "src/payload-types.ts"),
  },
});
