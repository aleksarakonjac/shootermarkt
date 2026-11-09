# Katalog disciplina (proširenje van MVP-a)

Status: nacrt, potvrđuje Aleksa. Shotgun (trap/skeet) se ne radi.
✓ = potvrdio Aleksa · ~ = iz zvaničnog pravilnika (ESC Challenge / ISSF 2026), čeka potvrdu · ? = nepoznato

Izvor za ESC: https://esc-shooting.org/documents → Competition Rules (PDF-ovi na api.esc-shooting.org/uploads/…).
ESC najavljuje jedinstven ESC Challenge Rulebook za sezonu 2027, pa se formati mogu promeniti.

## Već postoje (ne dirati)
ARM, ARW, APM, APW, ARMT, APMT, R3PM, R3PW (varijante 3x20 i 3x40), SPW.

## ISSF pojedinačno — dodajemo

| Kod | Disciplina | Kvalifikacija | Max | Finale | Status |
|---|---|---|---|---|---|
| RPRM / RPRW | 50m MK puška ležeći | 60 hitaca, 6×10, decimale | 654.0 | nema | ✓ |
| SPM | 25m sport pištolj M | kao SPW: 30 precizno (6×5, 240 s) + 30 brzo, celi brojevi, iksevi | 600 | kao SPW | ✓ (ISSF 2026 vodi 25m Pistol samo za žene, SPM je nacionalni) |
| FPM | 50m pištolj | 60 hitaca, 6×10, celi brojevi, iksevi | 600 | nema | ✓ |
| RFPM | 25m brzometni pištolj | 2 poluprograma × 30; svaki ima 6 serija po 5 hitaca: 2×8 s, 2×6 s, 2×4 s; celi brojevi, iksevi | 600 | ? | kvalifikacija ~ (ISSF 2026, 8.7.6.3), finale ? |

### Dodajemo posle (sve celi brojevi, iksevi, bez finala, max 600)

| Kod (predlog) | Disciplina | Kvalifikacija | Status |
|---|---|---|---|
| STPM / STPW | 25m standard pištolj | 60 hitaca: 4×5 u 150 s, 4×5 u 20 s, 4×5 u 10 s | ✓ gađa se na SSS; ženska konkurencija na SSS ? |
| R3P300M / R3P300W | 300m puška 3x20 | 60 hitaca, klečeći/ležeći/stojeći | ✓ |
| RPR300M / RPR300W | 300m puška ležeći | 60 hitaca | ✓ |
| STR300 | 300m standard puška | 3x20, Open (mešana konkurencija, bez pola) | ✓ |

R3P300 i STR300 se prikazuju kao 50m puška 3x20: serije grupisane po stavu (2×10 po stavu, zbir stava), ista
varijanta/raspored kao postojeći R3P 3x20. Redosled stavova isti za sve trostav discipline: klečeći → ležeći →
stojeći ✓.

Izostavljeno za sad: CFPM.

## Nazivi u aplikaciji

Na profilu bez pola; na rang listama i takmičenju dodaje se pol (seniori/seniorke, Men/Women). R3JM/R3JW se ne prikazuju (samo interno za SIUS import), vide se kao 50m puška 3x20.

| Kod | Srpski | Engleski |
|---|---|---|
| ARM / ARW | 10m vazdušna puška | 10m Air Rifle |
| APM / APW | 10m vazdušni pištolj | 10m Air Pistol |
| ARMT | 10m vazdušna puška miks | 10m Air Rifle Mixed Team |
| APMT | 10m vazdušni pištolj miks | 10m Air Pistol Mixed Team |
| R3PM / R3PW (3x40) | 50m puška 3x40 | 50m Rifle 3x40 |
| R3PM / R3PW (3x20) | 50m puška 3x20 | 50m Rifle 3x20 |
| RPRM / RPRW | 50m puška ležeći | 50m Rifle Prone |
| SPW / SPM | 25m pištolj | 25m Pistol |
| RFPM | 25m Rapid Fire pištolj | 25m Rapid Fire Pistol |
| FPM | 50m pištolj | 50m Pistol |
| STPM / STPW | 25m standard pištolj | 25m Standard Pistol |
| R3P300M / R3P300W | 300m puška 3x20 | 300m Rifle 3x20 |
| RPR300M / RPR300W | 300m puška ležeći | 300m Rifle Prone |
| STR300 | 300m standard puška | 300m Standard Rifle |
| SOLOARM/W, SOLOAPM/W | <oružje> ESC Solo (npr. 10m vazdušna puška ESC Solo) | 10m Air Rifle ESC Solo |
| ESC_*_TRIO / _DUET | <oružje> ESC Trio / ESC Duet | 50m Rifle Prone ESC Duet |

## ESC Challenge — zajedničko

- Faze se igraju od nule: rezultat se ne prenosi u sledeću fazu. Izuzetak je Solo, gde se kval 1 prenosi u kval 2.
- Kvalifikacija ima 2–3 faze, posle kojih ostaje top 4. Tada 1. i 2. idu u meč za zlato (GMM), a 3. i 4. u meč za bronzu (BMM).
- Ekipni rezultat u kvalifikaciji je zbir rezultata članova.
- U mečevima ekipa sa boljim zbirom serije dobija 2 poena, nerešeno donosi po 1 poen, slabija dobija 0. Ako obe dostignu cilj (12 ili 16 poena), gađa se još po jedan hitac ili serija dok se ne reši.
- Trio čine 3 člana istog pola iz istog saveza (1 ekipa po savezu). Duet čini 1 muškarac i 1 žena (najviše 2 para po savezu u finalu).
- Kategorije: M/W/MJ/WJ. Za U16/U18 postoje posebni pravilnici, varijante u kasnijoj fazi.

## ESC Challenge — formati

| Kod (predlog) | Događaj | Faze kvalifikacije (po članu) | Bodovanje kval | Meč za medalju | Status |
|---|---|---|---|---|---|
| SOLOARM/W | 10m AR Solo | K1: 30 hitaca/30 min → top 16; K2: +30 hitaca/30 min (prenosi se) → top 4 | pogodak ≥10.3 | 5 serija × 3 hica (150 s); više pogodaka pobeđuje; kod nerešenog pojedinačni hici | ✓ |
| SOLOAPM/W | 10m AP Solo | isto | pogodak ≥9.8 | isto | ✓ |
| ESC_AR_TRIO_M/W | 10m AR Trio | K: 20 hitaca → top 8; četvrtfinale: 20 hitaca → top 4; polufinale: 20 hitaca → raspored | decimale | pojedinačni hici (50 s), zbir 3 člana u decimalama, 2/1/0 poena, do 16 | ✓ |
| ESC_AP_TRIO_M/W | 10m AP Trio | isto | celi brojevi | isto (meč u decimalama) | ✓ |
| ESC_R3P_TRIO_M/W | 50m trostav Trio | K1: 15 klečeći + 15 ležeći + 15 stojeći (50 min) → top 8; K2: isto → top 4 | celi brojevi | pojedinačni hici, svaki član u drugom stavu (stoj/kleč/lež), decimale, do 16 | ✓ |
| ESC_R3P_DUET | 50m trostav Duet (M+Ž) | K1: 15+15+15 → top 8; K2: isto → top 4 | celi brojevi | pojedinačni hici, jedan član stojeći, drugi klečeći (bez ležećeg), decimale, do 16 | ✓ |
| ESC_RPR_DUET | 50m ležeći Duet (M+Ž) | K1: 20 hitaca/20 min → top 8; K2: 20 hitaca → top 4 | decimale | pojedinačni hici, decimale, do 16 | ✓ |
| ESC_SP_TRIO_W | 25m pištolj Trio Ž | K1: 3×5 precizno + 3×5 brzo (7/3) → top 8; K2: 3×5 brzo → top 4 | celi brojevi | serije od 5 brzih hitaca, pogodak ≥10.2, zbir pogodaka ekipe, 2/1/0, do 12 | ✓ |
| ESC_SP_DUET | 25m pištolj Duet (M+Ž) | isto kao Trio | celi brojevi | isto kao Trio, do 12 | ✓ |
| ESC_RFP_TRIO_M | 25m brzometni Trio M | K1: 2×5 u 8 s, 2×5 u 6 s, 2×5 u 4 s (30 hitaca) → top 8; K2: 4×5 u 4 s (20 hitaca) → top 4 | celi brojevi | serije od 5 hitaca u 4 s, pogodak ≥9.7, 2/1/0, do 12 | ✓ |
| ESC_RFP_DUET | 25m brzometni Duet (M+Ž) | isto kao Trio | celi brojevi | isto, do 12 | ✓ |

Napomene:
- 10m Duet postoji samo za U16/U18. Za seniore 10m ostaje ISSF mešoviti tim (ARMT/APMT).
- U pravilniku za Solo i U18 trostav/25m pištolj postoje i U18 varijante, kasnije.

## Još nepoznato
- Finale RFPM (pojedinačno). Postoje dva kandidata:
  - ISSF test format iz 2022: 8 finalista, dva polufinala po 4, serije od 5 hitaca u 4 s, pogodak ≥9.7, zlatni meč do 16 pogodaka.
  - Klasični format: 6 finalista, 8 serija po 5 hitaca, eliminacija od 4. serije.
- ISSF mešoviti tim trostav ne postoji ✓ (ne uvodimo).
- Mešoviti tim u brzometnom pištolju (RFPMT) ne uvodimo ✓.
