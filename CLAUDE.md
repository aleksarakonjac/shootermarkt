# Shootermarkt — CLAUDE.md

Radni naziv projekta: **Shootermarkt**
Opis: Platforma za praćenje rezultata i profila srpskih strelaca — po uzoru na Transfermarkt.de, ali za streljaštvo.

---

## Vizija projekta

Centralna platforma za srpsko streljaštvo koja obuhvata:
- Profile strelaca sa kompletnom istorijom nastupa
- Rangiranje u realnom vremenu po disciplini
- Forma score algoritam (weighted average poslednjih nastupa)
- Head-to-head poređenje strelaca
- Trend analiza i predviđanje forme
- Club leaderboard

---

## Tech Stack

```
Next.js 15 (App Router)
PostgreSQL via Supabase
Drizzle ORM
shadcn/ui + Tailwind CSS
Vercel (deploy)
Python microservice za PDF parsing (Railway ili Vercel Function)
Gemini API (Google AI Studio) za PDF → JSON ekstrakciju
```

### Zašto Drizzle umesto Prisma
Kompleksni analytics queriji (rangiranje, career stats, trend analiza) zahtevaju direktnu SQL kontrolu.

### Supabase + Drizzle podela
- Supabase klijent: Auth, Realtime (live rankings), Storage (avatari)
- Drizzle ORM: sve ostalo (queries, migrations)

### Gemini API
- Google AI Studio free tier — bez kreditne kartice
- Gemini 2.5 Flash model
- Koristi se isključivo za PDF bilten parsing
- Cena: praktično besplatna za ovaj use case (1-2 req/nedeljno)

---

## MVP Scope

### Discipline (MVP)
- `ARM` — 10m Air Rifle Men (vazdušna puška seniori)
- `ARW` — 10m Air Rifle Women (vazdušna puška seniorke)
- `APM` — 10m Air Pistol Men (vazdušni pištolj seniori)
- `APW` — 10m Air Pistol Women (vazdušni pištolj seniorke)

Kasnije: MK puška, MK sport pištolj, juniori. Bez trap/skeet.

### Tri podsistema

```
1. PUBLIC SITE       — profili, rangiranje, statistike (Next.js SSR/SSG)
2. SHOOTER PORTAL    — registracija i uređivanje sopstvenog profila
3. ADMIN PANEL       — potvrda identiteta, PDF import, unos rezultata
```

---

## Database Schema

```sql
-- Discipline sa metadata
disciplines (
  id, code ('ARM'|'ARW'|'APM'|'APW'),
  name, max_qual_score, has_decimals BOOLEAN, series_count INT
)

-- Klubovi
clubs (
  id, name, city, noc_code, sss_id
)

-- Strelci (profil)
shooters (
  id, first_name, last_name,
  birth_year, gender,
  club_id,
  license_number,
  created_by_self BOOLEAN,  -- da li je strelac sam napravio profil
  verified BOOLEAN,         -- admin potvrdio identitet
  avatar_url
)

-- Takmičenja
competitions (
  id, name, date, location,
  level ('drzavno'|'kup'|'regionalno'|'medjunarodno'),
  source_pdf_url
)

-- Rezultati
results (
  id, shooter_id, competition_id, discipline_id,
  qual_total    DECIMAL(6,1),  -- 630.8 (AR) ili 577 (AP)
  qual_inners   INT,           -- 18x — samo AP, AR nema
  qual_rank     INT,
  qual_series   JSONB,         -- [105.3, 105.8, 103.6, 106.2, 104.3, 105.6]
  qualified     BOOLEAN,
  final_total   DECIMAL(6,1),  -- NULL ako nije ušao u finale
  final_rank    INT,
  source        ('pdf_import'|'manual'),
  created_at
)
```

---

## Forma Score Algoritam

```
Forma score = weighted average poslednjih nastupa

Težine:
  zadnja 3 nastupa:  50%
  4-6 nastupa:       30%
  7-10 nastupa:      20%

+ konzistentnost bonus (niža std devijacija = stabilniji strelac)
+ trend koeficijent (raste/pada/stabilno)

Tri metrike po strelcu:
  Peak         — best result ikad
  Current forma — weighted average
  Trend        — ↑ ↓ →
```

---

## PDF Import Sistem

### Adapter Pattern (važno!)
Parser mora biti zamenljiv. Tri adaptera, isti JSON output:

```
DataSource (interface)
  ├── SiusXmlAdapter      ← kada dobiješ fajl od SIUS operatera
  ├── ISSFWebAdapter      ← scraper za results.issf-sports.info
  └── PdfAdapter          ← fallback za SSS biltene (MVP)
         ↓
  NormalizedResult (isti JSON format)
         ↓
  Admin review UI → commit u bazu
```

### PDF Parser Workflow

```
Admin uploada PDF bilten
  ↓
Python: pdfplumber ekstraktuje tekst
  ↓ (ili direktno PDF → Gemini koji čita PDF nativno)
Gemini API → strukturiran JSON
  ↓
Admin review UI (tabela, može da edituje greške)
  ↓
Confirm → commit u bazu
```

### Gemini Prompt za parsing

```
Analiziraj ovaj streljački bilten i vrati JSON.

Za svaki event (tabela) u PDF-u izvuci:
- discipline: kod discipline iz naslova tabele (ARM/ARW/APM/APW)
- stage: "qualification" ili "final"
- category: "senior" (ignoriši team i mixed team tabele)
- results: lista strelaca sa poljima:
    rank, bib_number, last_name, first_name, club_noc,
    series (niz serija kao decimalni brojevi),
    total (ukupan rezultat),
    inners (broj X ako postoji, inace null),
    qualified (true/false/null)

Ignoriši TEAM, MIXED TEAM i KONTROLNI MEČ tabele.
Vrati samo JSON, bez teksta pre ili posle.
```

### Discipline specifičnosti
- **Air Rifle** kvalifikacija → decimalni skorovi (105.3, 105.8...), 6 serija
- **Air Pistol** kvalifikacija → celi brojevi (98, 97...), 6 serija, ima inners (18x)
- Discipline code se može izvući iz SIUS fajl naziva: `ARM.0.001.pdf` → ARM
- Finale → elimination format, kumulativni skorovi

### Poznate osobenosti biltena
- Isti strelac se pojavljuje u više tabela (senior lista + junior lista)
- Parser uzima **senior** tabelu kao official
- SIUS generiše digitalne PDF-ove (ne skenove) — pdfplumber radi čisto
- Format je konzistentan između takmičenja (ISSF standard)

---

## Self-Registration Flow

```
Strelac se registruje (Supabase Auth)
  ↓
Popuni profil: ime, prezime, klub, licencni broj, disciplina
  ↓
Status: verified = false
  ↓
Admin prima notifikaciju, proverava identitet
  ↓
Admin: verified = true
  ↓
Strelac vidi svoj profil na public site-u
```

**Važno:** Strelci NE mogu sami da unose rezultate. Samo admin.

---

## Faze Razvoja

### Faza 1 — Osnova (MVP)
- [ ] Schema + Supabase setup
- [ ] Shooter registracija + profil
- [ ] Admin: potvrda identiteta
- [ ] Admin: ručni unos rezultata
- [ ] Javni profili strelaca

### Faza 2 — Import i Rangiranje
- [ ] PDF import tool sa Gemini API parserom
- [ ] Admin review UI za import
- [ ] Rangiranje po disciplini
- [ ] Forma score algoritam
- [ ] Istorija nastupa na profilu

### Faza 3 — Analitika
- [ ] Head-to-head poređenje strelaca
- [ ] Trend grafici
- [ ] Club leaderboard
- [ ] Predviđanje forme

---

## Budući Izvori Podataka

1. **SIUS database fajl** (prioritet) — kontaktirati SIUS operatera u Srbiji
2. **ISSF Results sajt** — `results.issf-sports.info` za međunarodna takmičenja, HTML scraping
3. **PDF bilteni SSS** — fallback, Gemini parsing

---

## Kontekst

- Developer: Aleksa Rakonjac, Pančevo
- Fakultet organizacionih nauka, Beograd
- Aktivni strelac (Junirorska reprezentacija Srbije), SK Pančevo 1813
- Sestra takođe aktivni strelac
- Ima uvid u bilten SSS takmičenja i potencijalan kontakt sa SIUS operaterom

---

## Napomene

- Projekat NE koristi Payload CMS (to je za kinopolis.rs)
- Custom admin sistem, ne gotovo rešenje
- Supabase Auth za authentication
- Drizzle za sve DB operacije osim auth/realtime
- Gemini API key u `.env` kao `GEMINI_API_KEY`
