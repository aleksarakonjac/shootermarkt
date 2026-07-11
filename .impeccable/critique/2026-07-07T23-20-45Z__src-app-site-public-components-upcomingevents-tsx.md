---
target: upcoming events sekcija na home page
total_score: 28
p0_count: 0
p1_count: 0
timestamp: 2026-07-07T23-20-45Z
slug: src-app-site-public-components-upcomingevents-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Countdown "za 24 dana" dobar; nema indikatora scroll pozicije |
| 2 | Match System / Real World | 3 | Sportski kontekst odgovara; mesec+dan bez odmah vidljive godine |
| 3 | User Control and Freedom | 2 | ‹/› ne komuniciraju kraj liste; nema jump-to-month |
| 4 | Consistency and Standards | 3 | Konzistentno sa site; ‹/› glifovi vs SVG ikone u ostatku UI |
| 5 | Error Prevention | 4 | Read-only, server filtrira prošla takmičenja |
| 6 | Recognition Rather Than Recall | 3 | Sve vidljivo, nema hijerarhije nivoa objašnjene novim korisnicima |
| 7 | Flexibility and Efficiency | 2 | Samo scroll+dugmad, nema jump-to-date |
| 8 | Aesthetic and Minimalist Design | 3 | Čisto; top accent bar dupira badge info |
| 9 | Error Recovery | 3 | Nema broken stanja; null return na praznoj listi |
| 10 | Help and Documentation | 2 | Nivo badge bez tooltipa |
| **Total** | | **28/40** | **Good** |

## Anti-Patterns Verdict

Detektor: 0 nalaza. LLM: Ne izgleda AI-generisano. Jedina kompoziciona slabost: h-1 accent bar + level badge dvostruko kodiraju isti podatak.

## Priority Issues

**[P2] Scroll depth nevidljiv** — korisnik ne zna gde je u listi 10 kartica. Fix: desni edge fade + disabled state na dugmadima.

**[P2] ‹/› ne komuniciraju kraj + Unicode glifovi vs SVG** — nedoslednost. Fix: disabled state + SVG chevron ikone.

**[P2] Top accent bar dupira badge** — 4px colorni bar nosi istu info kao badge. Fix: ukloni bar, pojačaj badge.

**[P2] Brand-primary crvena za count badge čita kao alert** — "10 najavljeno" u #C20000 izgleda kao error. Fix: koristiti brand-accent (plava) ili neutral.

**[P3] Nivo badge bez hijerarhije** — navijači ne znaju razliku Državno/Regionalno. Fix: tooltip na hover/focus.

## Persona Red Flags

Casey (strelac na telefonu): ne vidi kraj carousel-a; count badge skriven scrollom; ‹ bez feedbacka.
Jordan (navijač novi): crveni count badge = alarm; nema tooltip za nivo; hover efekt nevidljiv na touchu.

## Minor Observations

- month text all-caps 9px na 1x displayima potencijalno nečitljiv
- drag cursor: grab stalno vidljiv pre mousedown
- select-none blokira copy paste kompeticionih naziva
