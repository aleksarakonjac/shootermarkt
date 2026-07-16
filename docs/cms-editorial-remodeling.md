# CMS i sportski editorial remodeling

Status: Faza 1 — CMS infrastruktura deployovana; čeka domen, prvi admin i migraciju sadržaja  
Vlasnik: Aleksa / Codex  
Cilj: Payload ostaje editor i media CMS, ali se odvaja od javnog Shootermarkt runtime-a. Članci mogu da prikazuju aktuelne sportske podatke bez kopiranja rezultata u CMS.

## Pravila

- Javni sajt ne importuje Payload niti deli njegov runtime ili DB pool.
- Payload čuva sadržaj, media fajlove i reference; sportski podaci ostaju u Drizzle bazi.
- CMS blok čuva samo stabilan sportski ID i podešavanje prikaza.
- Ako CMS nije dostupan, javni sajt koristi cache ili uredan fallback — nikad ne blokira celu stranicu.
- Ne praviti custom rich-text editor, upload sistem ili poseban live blok dok postojeći Payload/Lexical blokovi pokrivaju potrebu.

## Otvorene odluke

- [x] CMS Vercel projekat: privremeni CMS domen je `shootermarkt-cms.vercel.app`; `cms.shootermarkt.rs` se dodaje tek nakon kupovine domena.
- [x] CMS baza: zaseban Supabase projekat/baza za Payload sadržaj i CMS korisnike.
- [x] Lokacija CMS koda: zaseban `shootermarkt-cms` repozitorijum/projekat.
- [x] Prvi set sportskih blokova: takmičenje, rezultati, strelac i grafik forme. Live je stanje bloka rezultata, ne poseban blok.

## Faza 1 — Izdvojen CMS

### 1.1 CMS projekat

- [x] Lokalno pripremiti i početno commitovati zaseban CMS projekat: `/Users/aleksa/VS Code Projects/shootermarkt-cms` (`3cee1c6`).
- [x] Napraviti privatni GitHub repozitorijum: `aleksarakonjac/shootermarkt-cms`.
- [x] Napraviti zaseban Payload projekat i Vercel deployment (`shootermarkt-cms`, grana `cms-preview`).
- [x] Preneti kolekcije `articles`, `media` i `cms-users`.
- [x] Preneti Lexical editor, postojeće galerije i sportske blokove.
- [x] Podesiti `CMS_DATABASE_URL`, `PAYLOAD_SECRET` i CMS-only varijable okruženja.
- [x] Napraviti prvi CMS administratorski nalog.

**Lokalno provereno:** produkcioni Next build prolazi; Payload import mapa je preneta iz postojećeg CMS-a. Lokalni Node 24 ne podržava Payload CLI generator, pa se za buduće regenerisanje koristi Node 20/22 u CI/Vercel okruženju.

**Završeno kada:** CMS admin radi van public deployment-a i public projekat više nema Payload rute ni `withPayload` konfiguraciju.

### 1.2 Baza i migracija sadržaja

- [x] Kreirati zaseban Supabase CMS projekat: `xorjxldpkrsevbnihddv` (`eu-west-1`).
- [x] Kreirati Payload tabele uz TLS-verifikovanu konekciju.
- [x] Proveriti postojeći sadržaj: stari CMS nema članke ni media fajlove, pa migracija podataka nije potrebna; nov admin je napravljen direktno u novom CMS-u.
- [x] Proveriti statuse, autore, slugove, kategorije i tagove: nema postojećih dokumenata za prenos.

**Završeno kada:** svi postojeći članci i draftovi postoje u CMS-u, sa istim javnim URL-ovima.

### 1.3 Trajne slike

- [x] Kreirati javni Supabase Storage bucket `media` (PNG/JPEG/WebP, najviše 50 MB).
- [x] Preuzeti Supabase CA sertifikat i generisati server-only S3 pristupne ključeve.
- [x] Povezati Payload Media kolekciju sa Supabase S3 adapterom.
- [x] Sačuvati `thumbnail` i `card` varijante slika.
- [ ] Proveriti upload, brisanje i javni prikaz posle novog deploy-a (potreban prvi CMS admin nalog).

**Završeno kada:** media fajlovi nisu vezani za lokalni Vercel filesystem.

## Faza 2 — Public content-read put

### 2.1 CMS read interface

- [x] Definisati samo javno potrebne odgovore: lista članaka, članak po slug-u i povezani članci po sportskom entitetu.
- [x] Ograničiti odgovor na public DTO u public klijentu; Payload dokument se ne koristi van CMS granice.
- [ ] Dodati autentikaciju između public sajta i CMS-a ako endpoint nije anoniman.

**Završeno kada:** public sajt ima jedan mali način za čitanje objavljenog sadržaja.

### 2.2 Cache i otkazivanje

- [x] Public sajt čita CMS preko timeout-a od pet sekundi.
- [x] Podesiti revalidaciju od 60 sekundi za CMS fetch i postojeći CDN `stale-while-revalidate` za homepage API.
- [ ] Vratiti poslednji cache ili fallback kada CMS nije dostupan.
- [ ] Dodati publish webhook za trenutno osvežavanje public cache-a.

**Završeno kada:** CMS problem ne može da izazove runtime timeout niti obori public stranicu.

### 2.3 Prebacivanje javnih potrošača

- [x] Homepage `NewsSection`.
- [x] Lista `/vesti`.
- [x] Detalj `/vesti/[slug]`, uključujući metadata.
- [x] `RelatedNewsSection` na profilima strelaca i takmičenja.
- [x] Admin ticker izbor vesti.
- [x] Ukloniti `getPayloadClient` iz public čitanja; Payload runtime se uklanja nakon produkcione potvrde novog CMS puta.

**Završeno kada:** Payload je fizički i runtime odvojen od javnog sajta.

## Faza 3 — Sportski editor MVP

### 3.1 Pretraga entiteta

- [ ] Dodati CMS-polju pretragu strelaca.
- [ ] Dodati CMS-polju pretragu takmičenja.
- [ ] Dodati CMS-polju pretragu klubova ako je potrebna za prvi set blokova.
- [ ] CMS čuva samo validiran ID i prikazani naziv za lakše uređivanje.

**Završeno kada:** urednik nikada ne mora ručno da zna numerički ID.

### 3.2 Blokovi

- [ ] Blok takmičenja: naziv, datum, status, lokacija i link.
- [ ] Blok rezultata: takmičenje, disciplina, faza i `top N`.
- [ ] Blok strelca: profil, klub, forma i link.
- [ ] Blok grafik forme: strelac, disciplina i period.

**Završeno kada:** blokovi rade na postojećim objavljenim člancima i čitaju aktuelne podatke iz sportske baze.

### 3.3 Prikaz i fallback

- [ ] Jedno mesto za validaciju i prikaz sportskih blokova.
- [ ] Nevalidan/obrisan sportski ID prikazuje diskretan fallback, bez rušenja članka.
- [ ] Ispravka rezultata u sportskoj bazi menja prikaz članka bez uređivanja članka.

**Završeno kada:** članak ne sadrži kopirane sportske rezultate.

## Faza 4 — Povezane vesti

- [ ] Standardizovati relacije: tema, strelac, takmičenje, klub i disciplina.
- [ ] Prebaciti postojeće sportske tagove na stabilne ID-jeve.
- [ ] CMS read interface filtrira povezane članke direktno, bez učitavanja stotina članaka u memoriju.
- [ ] Prikazati povezane vesti na stranicama sportskih entiteta.

**Završeno kada:** strelac, klub ili takmičenje automatski dobijaju svoje relevantne vesti.

## Faza 5 — Live i napredni workflow

- [ ] Blok rezultata automatski prikazuje `uskoro`, `live` ili `završeno` prema takmičenju.
- [ ] Oceniti potrebu za zakazivanjem objave, SEO pregledom i dodatnim uredničkim statusima.
- [ ] Oceniti AI draft, prevod i naslov kao odvojene funkcije.

**Završeno kada:** uvodi se samo workflow koji je dokazano potreban redakciji.

## Verifikacija po fazi

- [ ] Funkcionalna provera odgovarajućih ekrana.
- [ ] `pnpm exec next build --webpack` za public projekat.
- [ ] Provera Vercel deployment-a i response headera.
- [ ] Mobilna provera relevantnih javnih prikaza.
- [ ] Ažurirati ovaj dokument pre početka sledeće faze.
