# Izmene na Početnoj Stranici (Homepage Redesign) — Dokumentacija za Agente

Ovaj dokument služi kao primopredaja i vodič kroz izmene napravljene tokom remodelovanja početne stranice platforme **Shootermarkt**. Početna stranica je transformisana iz statičke landing stranice u dinamičan, modularan sportski dashboard po uzoru na **Sofascore** i **Transfermarkt**.

---

## 1. Novi Moduli i Komponente

Uvedene su sledeće nove klijentske i serverske komponente:

### A. Ticker Traka (`src/app/(public)/ticker.tsx`)
*   **Šta radi**: Pokretna traka (marquee) na vrhu ekrana koja prikazuje najnovije rezultate i predstojeće najave.
*   **UX Detalji**:
    *   Automatsko skrolovanje na desktopu.
    *   Na mobilnom uređaju se kreće sporije kako bi bila čitljiva i laka za interakciju.
    *   **Pauziranje na dodir/prevlačenje**: Automatsko skrolovanje se privremeno zaustavlja (pauzira) kada korisnik prevlači traku prstom ili pređe mišem preko nje. Skrolovanje se automatski nastavlja nakon 4 sekunde neaktivnosti.
    *   **Beskonačna petlja**: Koristi duplirani niz stavki i resetuje `scrollLeft` kada pređe polovinu širine kako bi se postigao efekat beskonačnog kretanja bez seckanja.

### B. Sparkline Grafikon (`src/components/sparkline.tsx`)
*   **Šta radi**: Lagana SVG komponenta koja crta linijski grafikon trenda rezultata strelca kroz poslednjih 5 takmičenja.
*   **Vizuelni detalji**: Linija i pulsirajuća tačka se automatski boje u zeleno (`var(--success)`) ako je trend pozitivan (novi rezultati su bolji od starijih) ili u crveno (`var(--brand-primary)`) ako je trend opadajući.

### C. Brzi H2H Duel (`src/app/(public)/quick-h2h-client.tsx`)
*   **Šta radi**: Interaktivni widget u desnoj koloni koji omogućava korisnicima da izaberu dva verifikovana strelca i uporede njihove statistike.
*   **Statistike**: Prikazuje međusobni skor (wins/draws/losses) za mečeve gde su obojica učestvovali, kao i poređenje trenutne forme i najboljeg rezultata (Peak) za njihove zajedničke discipline.

### D. Autocomplete Pretraga (`src/app/(public)/search-bar-client.tsx`)
*   **Šta radi**: Polje za pretragu na vrhu stranice koje pretražuje listu verifikovanih strelaca po imenu i klubu u realnom vremenu i omogućava brzu navigaciju na profil klikom na rezultat.

---

## 2. Server Actions (`src/app/(public)/actions.ts`)

Dodat je novi fajl sa Server Actions za klijentske komponente:
*   `getVerifiedShooters()`: Vraća listu svih verifikovanih strelaca (ime, prezime, klub, nacionalnost) sortirano po prezimenu. Koristi se za pretragu i selektore.
*   `compareShooters(idA: number, idB: number)`: Računa kompletnu H2H statistiku za dva strelca direktno iz baze. Računa i prosečnu formu i pronalazi sve mečeve gde su obojica učestvovali u istoj disciplini da bi odredio međusobni skor.

---

## 3. Remodelovana Početna Stranica (`src/app/(public)/page.tsx`)

Stranica je postavljena na dinamičko renderovanje (`export const dynamic = "force-dynamic"`) kako bi uvek prikazivala najnovije podatke.

### Izgled (Layout):
*   Izgled je organizovan u **dvokolonski grid** (`grid-cols-1 lg:grid-cols-3`):
    *   **Glavni sadržaj (Levo - 2/3 širine)**:
        *   Autocomplete pretraga strelaca.
        *   **Nedavni rezultati**: Kartice za poslednja takmičenja sa informacijama o lokaciji, datumu i najboljem rezultatu/strelcu meča.
        *   **Top Forma**: Tabela sa klijentskim tabovima za prebacivanje disciplina (ARM, ARW, APM, APW) i SVG sparkline grafikonima za svakog strelca u tabeli.
    *   **Bočni paneli (Desno - 1/3 širine)**:
        *   Brzi H2H Duel widget.
        *   Predstojeća takmičenja / Kalendar najava (kombinuje buduća takmičenja i nove nepročitane obaveštenja).
        *   **Klupski Leaderboard**: Rang lista klubova izračunata dinamički na osnovu prosečnog Forma Score-a njihovih strelaca u procentima u odnosu na maksimalni rezultat discipline.

---

## 4. Tehničke Popravke (Lints & Compile)

*   **Tipovi u `ReviewRow`**: Tokom build-a je ispravljena greška u `src/lib/ssc/adapter.ts` (linije 169-176) gde su vrednosti `null` i `false` bile pogrešno dodeljivane opcionim poljima interfejsa `ReviewRow` koja primaju isključivo `undefined` ili `string`. Vrednosti su zamenjene sa `undefined`.
