# Shootermarkt – Overnight Execution Backlog

## GLOBAL RULES (NEVER SKIP)

- UI/UX reference:
  - Transfermarkt (information density, structure)
  - SofaScore light mode (cards, rhythm, spacing)

- After EVERY major change:
  - run `impeccable audit`
  - run `impeccable critique`
  - fix all issues before continuing

- Always ensure:
  - no layout regressions
  - mobile responsiveness preserved
  - no duplicate UI modules introduced

---

# 1. UI CLEANUP (LOW COMPLEXITY, DO FIRST)

## 1.1 Header restructuring

### Task 1.1.1 – Move search bar
- Move search bar from page body into global header
- Ensure it is visible on all pages
- Ensure mobile layout remains intact

DONE WHEN:
- search exists only in header
- no duplicate search inputs remain

---

### Task 1.1.2 – Remove dashboard title
- Remove or significantly reduce "Shootermarkt Dashboard" heading
- Reduce vertical spacing in top section

DONE WHEN:
- no large H1 consuming viewport space
- layout feels denser

---

## 1.2 Right column restructure

### Task 1.2.1 – Reorder modules
Rebuild right column order:

1. Current / upcoming competitions
2. Recently finished competitions
3. Duel module (move lower priority)

DONE WHEN:
- duel is NOT first module anymore
- competition modules are visually prioritized

---

## 1.3 Marquee strip

### Task 1.3.1 – Implement marquee component

Build auto-rotating marquee strip:

- auto scroll horizontally
- smooth infinite loop
- pause on hover
- lightweight UI (no heavy animations)

CONTENT:
- news highlights OR live updates

DONE WHEN:
- marquee exists and loops automatically
- no layout shift issues
- performs smoothly

---

# 2. HOMEPAGE REBUILD (MAIN UI STRUCTURE)

## 2.1 Featured news module

### Task 2.1.1 – Featured news section
- Create "Featured News" module
- Display top 3–5 articles
- Emphasize first article visually

DONE WHEN:
- section is clearly separated
- supports responsive layout

---

## 2.2 Competitions module

### Task 2.2.1 – Competition overview block
- Add tab/segmented control:
  - Live
  - Upcoming
  - Finished

DONE WHEN:
- all 3 states render correctly
- switching tabs is smooth

---

## 2.3 Live competition module

### Task 2.3.1 – Active competition display
- Show currently active competition (if exists)
- Include:
  - name
  - status
  - quick score/summary

DONE WHEN:
- only one active competition shown
- fallback state exists (no active competition)

---

## 2.4 Rankings widget (core homepage element)

### Task 2.4.1 – Rankings module base
- Create homepage ranking block

### Task 2.4.2 – Discipline submodules
- Split by discipline
- Show top 5–10 athletes per discipline
- Card-based layout

DONE WHEN:
- multiple disciplines supported
- consistent card UI
- no layout overflow

---

# 3. CORE ARCHITECTURE (HIGH IMPACT)

## 3.1 Region / scope system (CRITICAL)

### Task 3.1.1 – Define region model
Implement global scope system:

- global
- europe
- country-based (default: Serbia)

DATA RULE:
- all queries must support `region` filter

---

### Task 3.1.2 – Region switching UI
- Add UI control for region selection
- Persist selection (local storage or session)

DONE WHEN:
- switching region updates all modules
- state persists on refresh

---

### Task 3.1.3 – Data filtering layer
- Apply region filter to:
  - competitions
  - rankings
  - results

DONE WHEN:
- no unfiltered global leakage in UI

---

# 4. ADMIN SYSTEM (MAJOR FEATURE)

## 4.1 Admin dashboard (CRUD)

### Task 4.1.1 – Base admin panel
- Create `/admin` route
- Layout for managing:
  - athletes
  - competitions
  - results

---

### Task 4.1.2 – Manual data entry
- Add CRUD forms for all entities

DONE WHEN:
- create/edit/delete works for all entities

---

### Task 4.1.3 – Bulk import system
- File upload (CSV/JSON)
- Parse and validate data
- Import into DB

DONE WHEN:
- successful batch import supported
- error handling for invalid rows

---

## 4.2 Scraping automation system

### Task 4.2.1 – Scraper architecture
Create pipeline structure for:

- ISSF
- SIUS
- ESC
- SSS

---

### Task 4.2.2 – Scheduled scraping jobs
- Add cron/job runner
- Fetch external data periodically

---

### Task 4.2.3 – Deduplication layer
- Prevent duplicate entries
- Match by competition + date + athlete

DONE WHEN:
- no duplicate results inserted

---

# 5. CMS LAYER (CONTENT SYSTEM)

## 5.1 Payload CMS integration

### Task 5.1.1 – CMS setup
- Integrate Payload CMS for:
  - articles
  - news
  - media

---

### Task 5.1.2 – Unified content layer
- Connect CMS with frontend

DECISION RULE:
- CMS handles content only
- custom backend handles sports data

DONE WHEN:
- articles render from CMS
- no coupling with competition logic

---

# 6. QUALITY PIPELINE

## 6.1 Impeccable review loop

### Task 6.1.1 – Mandatory QA step
After every feature:

- run `impeccable audit`
- run `impeccable critique`
- fix all issues

---

### Task 6.1.2 – UI consistency enforcement
Ensure:
- Transfermarkt-level density
- SofaScore-like clarity
- no oversized spacing
- consistent card system

DONE WHEN:
- UI passes critique without major issues

---

# EXECUTION ORDER (IMPORTANT)

1. UI cleanup (1.1 → 1.3)
2. Homepage rebuild (2.x)
3. Region system (3.x)
4. Competition filtering (3.3 dependency)
5. CMS integration (5.x)
6. Admin dashboard (4.1)
7. Scraping system (4.2)
8. Final QA pass (6.x)

---

# END