# Team Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import club team standings from SIUS PDF bulletins and show them on competition and shooter pages; give mixed teams a club name and create their missing shooters.

**Architecture:** New `team_results` + `team_result_members` tables fed by a new deterministic page parser, committed through their own admin route, rendered as a `team` stage inside each discipline/category block. Mixed teams reuse the existing commit path with two opt-in additions.

**Tech Stack:** Next.js 15, Drizzle ORM, Supabase Postgres, unpdf, vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-27-ekipni-rezultati-design.md`

## Global Constraints

- Team rank, total and members come from the bulletin. The site computes nothing.
- Parenthesized results (listed with a team, not counted) are not imported into team results.
- A page that fails verification is reported in `warnings`; it never drops the rest of the bulletin.
- Team appearances do not affect forma, personal peak or score statistics.
- An existing shooter link is never overwritten.
- New shooters are created only from the PDF review (`createMissing`); SIUS, ISSF, manual and live paths keep creating none for teams.
- UI labels: `Ekipno` / `Team`, stage key `team`, badge `T`.
- Production migration and deploy only after the user confirms.

## Review Focus

- Two teams with the same name in one list: both kept, second suffixed ` (2)` (Task 2 test).
- A team page whose member sum differs from the team total: warning, other pages still imported (Task 2 test).
- Re-import after the admin linked a member by hand: no duplicate team, link unchanged (Task 5 test).
- A new shooter present in both the individual and the team list, renamed in review: created once, under the new name (Task 6 test).
- A discipline/category with team results only: its block still appears (Task 7 test).

---

### Task 0: Base branch

Worktree `.claude/worktrees/team-results`, branch `feat/team-results`, base `40d6b83` = PR 5 (SIUS foreign bulletins, mixed match days, competition filters) merged with `origin/main` `e70c905`. At that commit: web 264, adapters 114, db 22 tests pass, web build passes, `db:generate` reports no changes. Latest migration is `0055_shallow_shriek`.

- [x] Merge the other sessions' work and record the baseline.
- [ ] **Before Task 1:** `git fetch`; merge `origin/main` (and PR 5 if it has new commits) into the branch and rerun both test suites. Another session is changing SIUS shooter linking (SIUS id as ISSF id); if that landed, recheck Task 4 against `import-commit.ts`.
- [ ] Commit this plan and the spec.

---

### Task 1: Schema and types

**Files:**
- Modify: `packages/db/src/schema.ts` (after `mixedTeamResults`)
- Modify: `packages/db/src/pdf-import-types.ts`
- Create: next migration in `packages/db/drizzle/`

**Interfaces (Produces):**

```ts
export interface TeamMemberEntry {
  firstName: string; lastName: string; fullName?: string;
  teamNoc: string; nationAssumed?: boolean; nationUnstated?: boolean;
  series: number[]; total: number; inners: number | null;
  shooterId?: number; isNew?: boolean; suggestedShooterId?: number; suggestedName?: string;
}
export interface TeamResultEntry {
  skip: boolean; disciplineCode: DisciplineCode; category: AgeCategory;
  eventName?: string | null; eventDate?: string | null;
  teamName: string; rank: number | null; total: number | null; inners: number | null; remark?: string | null;
  members: TeamMemberEntry[];
}
```

- `ParsedBilten.teamResults?: TeamResultEntry[]`
- `MixedTeamEntry` adds `clubName?`, `createMissing?`, `mShooterId?`, `mSuggestedShooterId?`, `mSuggestedName?`, `mIsNew?`, `mGender?: "M" | "F"` and the same six with `f`.
- Table `teamResults` (`team_results`): `id`, `competitionId` (not null, cascade), `competitionEventId` (nullable, → `competition_events`), `disciplineId` (not null), `category` (age enum, not null), `teamName` varchar(200) not null, `rank` int, `total` decimal(7,1), `inners` int, `remark` varchar(10), `source` (result enum, default `pdf_import`), `createdAt`. Unique `team_results_comp_event_disc_cat_name_unique` on (competition, event, discipline, category, teamName) **nullsNotDistinct**; index on `competitionId`.
- Table `teamResultMembers` (`team_result_members`): `id`, `teamResultId` (not null, cascade), `position` smallint not null, `shooterId` (→ shooters, set null), `name` varchar(200) not null, `series` jsonb `number[]` not null, `total` decimal(6,1) not null, `inners` int. Indexes on `teamResultId`, `shooterId`.
- `mixedTeamResults.clubName`: varchar(200), nullable.

- [ ] **Step 1: Add the tables, column and types.**
- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @shootermarkt/db db:generate`
Expected: one new file, `0056_*`, containing only two `CREATE TABLE`, their constraints/indexes, and `ADD COLUMN "club_name"`. No `DROP`. Do not run `db:migrate`.

- [ ] **Step 3: Type check** — `pnpm --filter @shootermarkt/web exec tsc --noEmit` → no errors.
- [ ] **Step 4: Commit** — `feat: team results tables and import types`

---

### Task 2: Parser

**Files:**
- Create: `packages/adapters/src/pdf-import/sius-club-teams.ts`
- Modify: `sius-pdf.ts` (`parseSiusPages`, the `kind === "T"` branch), `sius-teams.ts`, `sius-names.ts` (`resolveGuessedNames`), `sius-nations.ts` (`resolveNations`, `resolveUnstated`)
- Test: `packages/adapters/src/pdf-import/sius-club-teams.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `splitName`, `clubNation`, `SCORE`, `topmost`, `Item`.
- Produces: `interface ClubTeamPage { discipline: DisciplineCode; category: AgeCategory; eventName: string | null; eventDate: string; items: Item[] }` and `parseClubTeams(pages: ClubTeamPage[]): { entries: TeamResultEntry[]; warnings: string[] }`. `parseSiusPdf` returns `teamResults`.

**Page format** (fixture `sss-kup-10m-nis-2026.pdf`, files `Q…TA….<DISC>…pdf`): headers `Rank`, `Bib No`, `Name`, `Total`; team row = integer rank left of the bib column, team name, series, total (`1865.2` or `1691-32x`); member rows below = bib in the bib column, name, series, total. Total in parentheses = not counted. A member row with no total (`DNS`) is skipped. A team total may sit 1pt below its row (use the ±3 line tolerance already used in `sius-teams.ts`). Body ends at `Summary` / `Legend` / `Version of`.

**Rules:**
- Member = row with a total not in parentheses. Verify `sum(member totals) == team total` (tolerance 0.05); on any failure the whole page yields a warning `Ekipe <DISC>: strana nije pročitana (<date>)` and no entries. A team row with `DNS|DNF|DSQ` instead of a rank keeps `rank: null`, `total: null`, `remark`.
- Same `teamName` twice in one list: the later one gets ` (2)`, ` (3)`.
- In `parseSiusPages`: collect `kind === "T"` pages with a non-mixed, supported discipline and stage `Q` (or `I` with `RESULTS`). Discipline and category use the individual-list logic already in the loop (`airCode`/`juniorCode`, `LIST_CODES`, `subtitleList`); unknown category → warning for that page, never `return null`.
- `eventName`/`eventDate`: copy from the individual qualification event with the same discipline, category and file date, **after** main/extra match assignment. Without one: `null`/`null` when the date is the earliest in the bulletin, else `title ?? matchEventName(2, date)` and the file date.
- `resolveGuessedNames` and `resolveNations` also process `teamResults[].members`.
- Mixed: `TeamPage.junior: boolean` becomes `category: AgeCategory` (also used by `dayKey` and `qualDays` in `parseMixedTeams`) = `junior` for the `J` code suffix, list code `20` or a `Junior` item, else `parseCategory(<kadet|pionir|U-xx subtitle>)`. `MixedTeamEntry.clubName` = team label as printed when `prefixNoc(label)` is undefined, else undefined. `numberTeams` stays as is.

- [ ] **Step 1: Write the failing test**

```ts
const bilten = await parseSiusPdf(readFileSync(new URL("./__fixtures__/sss-kup-10m-nis-2026.pdf", import.meta.url)));
const teams = (code: string) => bilten!.teamResults!.filter((t) => t.disciplineCode === code);

it("reads club teams with counted members only", () => {
  expect(teams("ARM").map((t) => [t.rank, t.teamName, t.total])).toEqual([
    [1, "Cika Mata", 1865.2], [2, "Novi Sad 1790", 1815.8], [3, "Jasenica", 1755.6]]);
  expect(teams("ARM")[0].members.map((m) => [m.lastName, m.firstName, m.total])).toEqual([
    ["JOVANOVIC", "Stevan", 625.3], ["JOVANOVIC", "Bogdan", 621.1], ["STANKOVIC", "Jovan", 618.8]]);
});
it("reads pistol inners, a wrapped total and skips DNS and parenthesized shooters", () => {
  expect(teams("APM")[0]).toMatchObject({ teamName: "Pancevo 1813", total: 1691, inners: 32 });
  expect(teams("APM")[2]).toMatchObject({ teamName: "Policajac", total: 1636, inners: 25 });
  expect(teams("APM").every((t) => t.members.length === 3)).toBe(true);
});
```

Add two synthetic-`Item[]` tests on `parseClubTeams`: `"suffixes a repeated team name"` (two teams `Klub` → `["Klub", "Klub (2)"]`) and `"reports a page whose sum is wrong and keeps the others"` (pages A valid, B off by 1 → entries only from A, `warnings.length === 1`).
Add to `sius-pdf-international.test.ts`'s synthetic mixed pages: a subtitle `U21` yields `category: "junior"`, and an unprefixed label yields that `clubName`.

- [ ] **Step 2:** `pnpm --filter @shootermarkt/adapters test` → new tests FAIL (`teamResults` undefined).
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** same command → PASS, existing SIUS tests included.
- [ ] **Step 5: Commit** — `feat: parse SIUS club team standings`

---

### Task 3: Match members during parsing

**Files:**
- Modify: `packages/adapters/src/pdf-import/parse-import.ts`
- Test: `packages/adapters/src/pdf-import/team-members.test.ts`; Create: `team-members.ts` (pure, no db import)

**Interfaces (Produces):** `matchMember(m: { firstName: string; lastName: string; teamNoc: string }, shooters: MatchCandidate[]): { shooterId?: number; isNew: boolean; suggestedShooterId?: number; suggestedName?: string }`. `parsePdfImport` returns `teamResults` and mixed entries with `createMissing: true` and the `m*`/`f*` draft fields; `mGender: "M"`, `fGender: "F"`.

- [ ] **Step 1: Failing test** — exact name and nation → `{ shooterId, isNew: false }`; unknown → `{ isNew: true }`; spelling variant that `matchShooter` suggests → `isNew: true` plus `suggestedShooterId`.
- [ ] **Step 2:** adapters test → FAIL.
- [ ] **Step 3: Implement** with `matchShooter`, same mapping as individual rows in `parsePdfImport`.
- [ ] **Step 4:** adapters test → PASS.
- [ ] **Step 5: Commit** — `feat: match team members to shooters on PDF import`

---

### Task 4: Shared shooter creation

**Files:**
- Create: `apps/web/src/lib/ensure-shooter.ts`
- Modify: `apps/web/src/lib/import-commit.ts` (the `if (!shooterId) { … }` block inside the row loop)

**Interfaces (Produces):**

```ts
export type ShooterDraft = { firstName: string; lastName: string; teamNoc: string; birthYear?: number | null;
  gender?: "M" | "F" | null; apparatus?: string | null; clubId?: number | null; issfId?: string | null };
export async function ensureShooter(draft: ShooterDraft, known: KnownShooters): Promise<number>;
```

`KnownShooters` wraps the `allShooters` array and `shooterByIssfId` map that `commitImportReview` already builds, plus `loadKnownShooters(): Promise<KnownShooters>`. Behaviour moves unchanged: issfId first, then `matchShooter` exact, patch empty fields, else insert (`verified: false`) and append to `known`.

- [ ] **Step 1: Move the block** into `ensureShooter`; `import-commit.ts` calls it.
- [ ] **Step 2:** `pnpm --filter @shootermarkt/web test` and `tsc --noEmit` → PASS, same as baseline.
- [ ] **Step 3: Commit** — `refactor: extract ensureShooter from import commit`

---

### Task 5: Commit, preview, delete, merge

**Files:**
- Create: `apps/web/src/lib/import-commit-teams.ts`, `apps/web/src/lib/team-member-link.ts`, `apps/web/src/app/api/admin/import/commit-teams/route.ts`
- Modify: `lib/import-commit-mixed.ts`, `_shared/commitMixedTeams.ts` (`toQualCommit`), `lib/sius-bulk.ts` (`diffSiusImport`), `api/admin/import/preview/route.ts`, `api/admin/competitions/[id]/results/route.ts`, `lib/merge-shooters.ts`
- Test: `lib/team-member-link.test.ts`, `_shared/commitMixedTeams.test.ts`

**Interfaces (Produces):**

```ts
export function pickMemberShooter(m: { firstName: string; lastName: string; shooterId?: number },
  existing: number | null, individuals: { shooterId: number; firstName: string; lastName: string }[]): number | null;
export async function commitTeamResults(competitionId: number, entries: TeamResultEntry[]):
  Promise<{ inserted: number; updated: number; unchanged: number; skipped: number; errors: string[] }>;
export async function previewTeamResults(competitionId: number, entries: TeamResultEntry[]):
  Promise<{ status: ImportStatus; changes: string[] }[]>;
// sius-bulk.ts
diffSiusImport(competitionId, rows, teams, teamResults: TeamResultEntry[] = [])
```

**Rules:**
- Link priority: `existing` → `m.shooterId` → same-competition, same-discipline individual result with equal folded name (only if exactly one) → `null`, then `ensureShooter` (apparatus and gender from `DISCIPLINE_META`; `clubId` only if a club matches the team name; never create a club).
- Upsert on the unique key; replace that team's members in one transaction. `existing` is the old member row with the same folded name.
- Unchanged = same rank, total, inners, remark and members (name, series, total, link).
- Named match: `ensureCompetitionEvent`; reject a same-named event with another date exactly as `commitMixedTeamEntries` does.
- Route: `requireAdmin`, body `{ competitionId: number; entries: TeamResultEntry[] }`, 400 on bad shape, wrapped in `revalidatesPublicSite`.
- Mixed: when `createMissing`, each member without a link goes `pickMemberShooter` → `linkTeamMembers` → `ensureShooter` with `mGender`/`fGender`. `clubName` enters `stageColumns` (qualification) only when non-empty. Without `createMissing`, behaviour is unchanged.
- Results DELETE (individual branch) also deletes `teamResults` with the same competition/discipline/event/category filter; `deleteEmptyEvents` also requires no team results.
- `merge-shooters` moves `teamResultMembers.shooterId`.

- [ ] **Step 1: Failing tests**

```ts
const individuals = [{ shooterId: 7, firstName: "Ana", lastName: "Test" }];
const m = { firstName: "Ana", lastName: "TEST" };
it("keeps an existing link over everything", () => expect(pickMemberShooter({ ...m, shooterId: 9 }, 3, individuals)).toBe(3));
it("takes the reviewed shooter before the name match", () => expect(pickMemberShooter({ ...m, shooterId: 9 }, null, individuals)).toBe(9));
it("links by the individual result of the competition", () => expect(pickMemberShooter(m, null, individuals)).toBe(7));
it("does not guess between two namesakes", () => expect(pickMemberShooter(m, null, [...individuals, { shooterId: 8, firstName: "Ana", lastName: "Test" }])).toBeNull());
```

In `commitMixedTeams.test.ts`: `toQualCommit` carries `clubName`, `createMissing`, `mShooterId`, `fShooterId`, `mGender`, `fGender`.

- [ ] **Step 2:** web test → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** web test and `tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat: commit team results and create missing team shooters`

---

### Task 6: Admin review

**Files:**
- Create: `_shared/teamMemberRows.ts`, `_shared/teamMemberRows.test.ts`, `_shared/TeamReviewTable.tsx`
- Modify: `modes/PdfMode.tsx`, `_shared/NewShootersPanel.tsx`, `_shared/OverwriteCheck.tsx`, `_shared/MixedTeamReviewTable.tsx` (shows `clubName` next to the nation; assertion in its test)

**Interfaces (Produces):**

```ts
export function memberRows(teamResults: TeamResultEntry[], mixed: MixedTeamEntry[]): ReviewRow[]; // one per member of every non-skipped team
export function applyMemberPatch(teamResults, mixed, index: number, patch: Partial<ReviewRow>):
  { teamResults: TeamResultEntry[]; mixed: MixedTeamEntry[] };
```

**Rules:**
- `NewShootersPanel` (it already sorts and confirms `nationAssumed` groups; `memberRows` carries that flag) receives `[...rows, ...memberRows(...)]`; indexes ≥ `rows.length` route to `applyMemberPatch`. Its grouping by name and nation then applies one edit to both lists.
- The panel gets a gender select (`M`/`Ž`) for groups from mixed teams.
- `TeamReviewTable`: per discipline/category/match: rank, team, total, members with a "novi" mark, skip checkbox. Read-only otherwise.
- Club teams follow the individual "zaseban meč" checkbox, not the mixed teams' `teamMatch`. That checkbox and the match rename/date inputs apply to `teamResults` with the same event names; required fields as for individual rows. Prefill name and date from the parser when present.
- Commit order: individual rows → mixed → `commit-teams`. Counts added to `DonePanel` totals; `activeCount` includes teams. OverwriteCheck sends `teamResults`.
- Job result type gains `teamResults?`; both load paths set state; `reset` clears it.

- [ ] **Step 1: Failing test**

```ts
it("renames a shooter in the team list together with the individual row", () => {
  const next = applyMemberPatch([team([member({ lastName: "Test", isNew: true })])], [], 0, { lastName: "Testić" });
  expect(next.teamResults[0].members[0].lastName).toBe("Testić");
});
it("confirming a suggestion sets the member's shooter", () => { /* patch { shooterId: 5, isNew: false } → members[0].shooterId === 5, isNew false */ });
it("addresses mixed members by m and f", () => { /* index 1 of one mixed entry, patch { gender: "M" } → mixed[0].fGender === "M" */ });
```

Add to `PdfMode.test.tsx`: separate-match name typed once reaches both the commit and the commit-teams payload; confirming posts commit before commit-teams.

- [ ] **Step 2:** web test → FAIL. **Step 3:** implement. **Step 4:** web test → PASS.
- [ ] **Step 5: Commit** — `feat: review team results in PDF import`

---

### Task 7: Competition page

**Files:**
- Create: `apps/web/src/lib/competition-teams.ts` (+ test), `components/result-display/TeamResultsTable.tsx` (+ test)
- Modify: `takmicenja/[id]/page.tsx`, `CompetitionResultsClient.tsx`, `MixedTeamQualTable.tsx`, `takmicenja/page.tsx` (competitions with team results count as having results)

**Interfaces (Produces):**

```ts
export type TeamMemberRow = { shooterId: number | null; name: string; series: number[]; total: string; inners: number | null };
export type TeamRow = { id: number; teamName: string; rank: number | null; total: string | null; inners: number | null; remark: string | null; members: TeamMemberRow[] };
export function attachTeams(groups: DisciplineGroup[], teams: Array<TeamRow & { disciplineCode: string; disciplineName: string; apparatus: string | null; competitionEventId: number | null; eventName: string | null; eventDate: string | null; category: AgeCategory }>): DisciplineGroup[];
```

`DisciplineGroup["categories"][number]` gains `teams: TeamRow[]`. Blocks match by the same selection key as individual results (`CODE` or `CODE@eventId`, split by category when the discipline has several matches); a missing block or category is created.

**Rules:**
- Team-only blocks and categories take part in the existing filters (`groupFacets`); category labels use `categoryLabel(category, locale)`.
- Stage `team`: accepted from the URL, listed after final in the overview and stage toggle, labels `Ekipno` / `Team`, badge `T`. A team-only category opens on `team`.
- Table: rank with the medal icon used by `MixedTeamQualTable` for 1–3, team, total with inners. A row is a button (`aria-expanded`) that expands members one under another with series and total; linked names go to the shooter profile. Search matches team and member names.
- Mixed table shows `clubName` when present, nation and number otherwise.

- [ ] **Step 1: Failing tests** — `attachTeams`: teams land in the matching block and category; `"creates a block when only team results exist"`. `TeamResultsTable`: members hidden before click, all three visible after, linked member is an anchor, medal on rank 1 and none on rank 4.
- [ ] **Step 2:** web test → FAIL. **Step 3:** implement. **Step 4:** web test and `tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat: team stage on competition page`

---

### Task 8: Shooter profile

**Files:**
- Create: `apps/web/src/lib/shooter-team-results.ts` (+ test)
- Modify: `lib/shooter-results.ts`, `components/result-display/ResultsHistoryTable.tsx`, `strelci/[id]/page.tsx`

**Interfaces (Produces):** `getShooterTeamRows(shooterId: number, competitionIds?: number[]): Promise<ResultRowData[]>`; pure `toTeamHistoryRow(row, shooterId): ResultRowData` with `kind: "team"`, `rowKey: "t:<id>"`, `teamName`, `teamMembers`, `qualRank`/`qualTotal` = team's, match name and date as the mixed rows do.

**Rules:** third source in the competition-id union and in the page's initial load; expanded row lists every member; the row links to `?result=individual&disc=<key>&stage=team&category=<c>`. Every place that excludes `mixed` from statistics, best scores, charts or comparisons excludes `team` too (grep `kind ===` and `kind !==`).

- [ ] **Step 1: Failing tests** — `toTeamHistoryRow` fields; a history table with one individual 560 and one team 1690 shows both rows, and the best-score/series summary ignores the team row.
- [ ] **Step 2:** web test → FAIL. **Step 3:** implement. **Step 4:** web test and `tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat: team appearances on shooter profile`

---

### Task 9: Verify end to end

- [ ] **Step 1:** Ask the user for the Smederevo PDFs. Parse each; compare team ranks, totals and members with the document. Where a list code, category or page layout differs, fix the parser with a fixture test first, and update the spec if behaviour changes.
- [ ] **Step 2:** On a development database (never production): migrate, import the fixture twice; second run reports 0 inserted, 0 updated.
- [ ] **Step 3:** Check competition page and one profile in the browser, desktop and mobile.
- [ ] **Step 4:** `pnpm --filter @shootermarkt/web test && pnpm --filter @shootermarkt/adapters test && pnpm --filter @shootermarkt/web build` → PASS.
- [ ] **Step 5:** Report to the user and ask before the production migration and deploy. `apps/ingest` runs the PDF parser, so it deploys together with `apps/web`, migration first.
