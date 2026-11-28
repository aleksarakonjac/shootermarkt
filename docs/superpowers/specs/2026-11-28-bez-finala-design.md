# Ručna oznaka "Bez finala"

Datum: 2026-11-28 · Status: odobreno (pristup 1)

**Zašto.** Na nekim takmičenjima finale se ne puca i medalje se dele posle kvalifikacija. Stranica rezultata to
zna samo za fiksnu listu disciplina (`isQualOnlyDiscipline`).

**Pristupi.** (1) ručna oznaka u adminu (izabrano: tačna i kad finale samo još nije uvezeno; traži migraciju);
(2) automatsko pravilo sa In focus kartice i na stranici rezultata (pogrešne medalje dok finale nije uvezeno);
(3) automatski + ručna ispravka (najviše logike).

**Dizajn.**
- `competitions.no_final_groups`: lista ključeva `KOD[@meč]|kategorija`. Ponovni uvoz biltena je ne briše.
- Admin (Takmičenja → Uredi → Rezultati): čekboks "Bez finala" po pojedinačnoj disciplini × meč × kategorija.
- Rezultati: zlato/srebro/bronza u tabeli kvalifikacija kad su svi termini kvalifikacija po satnici gotovi.
- In focus: medalje na kvalifikacijama, bez Q oznake (i za fiksnu listu i za domaća završena bez finala).
- Oznaka se ignoriše ako grupa ima rezultate finala. Postojeća automatska pravila ostaju.

**Van obima.** Miks timovi, Q oznaka na stranici rezultata, medalje na profilu strelca.

**Deploy.** Migracija mora na bazu pre koda.
