# Payload CMS Child-System for Articles/News — Design

Date: 2026-07-04

## Purpose

Shootermarkt needs an articles/news subsystem: authored posts with images, rich
text, and custom embedded content (competition results, shooter profiles).
Content needs a decent editor UX for a small number of non-technical authors,
with a draft → review → publish workflow.

Per `CLAUDE.md`, the sports-data domain (shooters, competitions, results)
stays on the custom Drizzle/Postgres backend. This design adds Payload CMS as
a **child system** scoped strictly to content (articles, media) — it does not
own or duplicate sports data.

## Architecture

- Payload mounts inside the existing Next.js App Router app at `/cms`
  (admin UI at `/cms/admin`, REST/GraphQL API under `/cms/api/...`), using
  `@payloadcms/next`. Same repo, same Vercel deployment — no separate service.
- Payload uses `@payloadcms/db-postgres` against the **same** `DATABASE_URL`
  as Drizzle (same Supabase Postgres instance). Payload manages its own set of
  tables; Drizzle's schema is untouched and unaware of them. No FK
  relationships exist across the two ORMs' tables.
- Payload Auth is a **separate** login system from Supabase Auth. Supabase
  Auth continues to serve shooters/portal users. Payload's built-in auth
  serves only CMS users (admins/authors). The two never share sessions or
  tables.

## Collections & Access Control

- `CmsUsers` (Payload auth collection): `role` field — `admin` | `author`.
- `Articles`:
  - `title`, `slug` (auto-generated from title, unique)
  - `excerpt` (plain text, short)
  - `content` (Lexical rich text, with custom blocks — see below)
  - `coverImage` (relationship → `Media`)
  - `author` (relationship → `CmsUsers`)
  - `status`: `draft` | `in_review` | `published`
  - `publishedAt` (date, set on publish)
- `Media`: Payload upload collection for images (uses `sharp`, already a
  project dependency, for resizing/processing).

Access control rules:
- `author` role: can create/update their own articles; cannot set
  `status = published` (limited to `draft`/`in_review`).
- `admin` role: full access to all articles; only role that can set
  `status = published`.
- Public read (via API consumed by the Next.js frontend): only articles with
  `status = published`.

## Custom Blocks & Cross-System Data

Payload and the sports-data domain are separate systems sharing only a
Postgres instance. Custom blocks store a **reference ID only** — no data is
copied into Payload. Rendering resolves the reference against Drizzle at
request time.

- **Competition/result embed block**: field `competitionId` (number). Admin
  editor UI provides a custom React field with autocomplete search against
  the existing `/api/admin/competitions` endpoint. Frontend render: the
  article page reads `competitionId` from the block, runs a Drizzle query for
  competition/result details, and renders a card/table.
- **Shooter profile embed block**: field `shooterId` (number), same pattern —
  autocomplete against existing shooter search, Drizzle query at render time
  for name/club/forma score/avatar.
- **Image gallery block**: array of relationships → `Media`. Pure Payload,
  no cross-system dependency. Rendered as a grid.

Referential integrity is not enforced across systems (no cross-database FK).
If a referenced shooter or competition no longer exists in the Drizzle
tables at render time, the block must render a fallback (e.g. "podaci nisu
dostupni") rather than throwing.

## Public Rendering

- `/vesti`: list of published articles (Payload API, `status=published`,
  sorted by `publishedAt` desc), cards with cover image, excerpt, author.
- `/vesti/[slug]`: single article page. Lexical JSON is rendered to React via
  `@payloadcms/richtext-lexical`'s serializer; each custom block type is
  rendered by a corresponding React component (competition embed, shooter
  embed, gallery), keyed on block type.
- Visual design for both pages follows the existing brand design system
  (same Tailwind tokens and card patterns as `/takmicenja` and `/strelci`).
- **Implementation note**: the visual polish pass for `/vesti` and
  `/vesti/[slug]` is done using the `impeccable` skill (craft mode) during
  implementation, not ad hoc styling.

## Error Handling

- Cross-system reference errors (deleted shooter/competition) render a
  fallback within the block, not a page-level 500.
- If Payload is unreachable, `/vesti` pages should degrade gracefully rather
  than breaking the whole site — use Next.js caching/revalidation so a stale
  successful fetch can still serve if a live fetch fails.
- Role permission logic (`author` cannot publish, `admin` can) is enforced via
  Payload access control functions on the `Articles` collection.

## Testing

- Access control: automated checks that an `author` cannot set/persist
  `status = published`, and that an `admin` can.
- Cross-system fallback: render a block referencing a non-existent
  `shooterId`/`competitionId` and confirm graceful fallback output.
- End-to-end flow: create article as `author` (draft) → `admin` moves to
  `published` → article appears on `/vesti` only after publish, not before.

## Out of Scope (for this iteration)

- Scheduled/future-dated publishing automation (articles publish immediately
  when status is set, no cron-based scheduling).
- Comments, likes, or other reader interaction features.
- Additional custom blocks beyond the three listed (more can be added later
  following the same reference-ID pattern).
