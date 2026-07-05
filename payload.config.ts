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
    // database entirely.
    //
    // Each entry is a Minimatch GLOB, not a prefix — "cms_users" matches
    // only the literal table "cms_users", NOT "cms_users_sessions" (the
    // child table Payload generates for CmsUsers' built-in auth `sessions`
    // array field). Use a trailing "*" on any collection slug that has (or
    // gains) array/relationship/block sub-fields, which Payload
    // materializes as "<collection>_<field>" child tables. Verify against
    // `information_schema.tables` after any push, and update this list
    // BEFORE re-enabling push whenever a collection's fields change (e.g.
    // Task 6's blocks will add "articles_blocks_*" tables, and any
    // hasMany/array field on Articles adds "articles_<field>*").
    tablesFilter: ["payload_*", "cms_users*", "media*", "articles*"],
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
