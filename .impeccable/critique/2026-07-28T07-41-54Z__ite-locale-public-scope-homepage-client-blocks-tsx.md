---
target: homepage i sekcija Aktuelno
total_score: 28
p0_count: 1
p1_count: 1
timestamp: 2026-07-28T07-41-54Z
slug: ite-locale-public-scope-homepage-client-blocks-tsx
---
Method: dual-agent (A: /root/critique_a · B: /root/critique_b)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | LIVE, loading and retry are explicit; result freshness is not. |
| 2 | Match System / Real World | 4/4 | Competition levels, Q/E/F, names and scores fit shooting results. |
| 3 | User Control and Freedom | 3/4 | Rows and qualifications are reversible; lead card duplicates the competition destination. |
| 4 | Consistency and Standards | 3/4 | Lead is a link while recent events are disclosure buttons; their result summaries differ. |
| 5 | Error Prevention | 2/4 | Collapsed preview always reads a qualification winner without an explicit phase. |
| 6 | Recognition Rather Than Recall | 3/4 | Badges help specialists, but Q/E/F and +N assume prior knowledge. |
| 7 | Flexibility and Efficiency | 3/4 | Compact disclosure works, but a collapsed item lacks a clear phase-level fast path. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Dense but disciplined; accumulating micro-badges weakens scan rhythm. |
| 9 | Error Recovery | 3/4 | The error state offers a direct retry. |
| 10 | Help and Documentation | 1/4 | There is no visual explanation of phase abbreviations for newcomers. |
| **Total** | | **28/40** | **Solid specialist UI; align collapsed-preview semantics first.** |

## Anti-Patterns Verdict

**LLM assessment:** This does not read as AI-generated. It has a credible score-first sports-results grammar: restrained red states, monospace numerals, and data density that serves the task. The weakness is inconsistent information fidelity between the lead card and collapsed recent rows, not decorative excess.

**Deterministic scan:** `detect.mjs` returned exit 0 with an empty JSON array: 0 findings and no false positives.

## Overall Impression

Aktuelno is close to a strong specialist surface: a current event can be scanned from competition to phase to podium without losing country identity. Its biggest risk is that the collapsed recent-event row can make a qualification score look like the event's representative result, without saying so.

## What's Working

- `inlinePlaces()` keeps rank, shortened name, flag/NOC, and score in one repeated grammar while respecting the intentionally compact mobile layout.
- Final phases appear above qualification, and each expanded result visibly carries Q/E/F.
- The qualification expander is an accessible 44px control with localized screen-reader text; it solves disclosure without a nested interactive element.

## Priority Issues

### [P0] Collapsed recent rows can claim the wrong phase

**Why it matters:** The preview reads `discResults[0].phases[0].qualTop3[0]` and always shows `qualTotal`. A final may exist while the row advertises an unlabeled qualification score, which can mislead a shooter, coach, or supporter checking the result quickly.

**Fix:** Select the preview with the same policy as the expanded card—normally F, then E, then Q—and display its phase plus rank explicitly.

**Suggested command:** `$impeccable harden`

### [P1] Collapsed mobile rows drop result identity

**Why it matters:** On mobile, the level and winner surname are hidden, while rank, flag, and NOC are absent. The remaining number is not a trustworthy result summary by itself.

**Fix:** Reuse the existing compact result grammar in the collapsed preview: phase, rank, shortened name, flag/NOC, score. Keep it one line; do not hide or truncate the identity fields.

**Suggested command:** `$impeccable adapt`

### [P2] Phase-row navigation is not apparent on touch

**Why it matters:** The whole result row links to a phase, but the only visual cue is a hover opacity change. Touch users do not get that cue, while the lead card also has two links to the same competition.

**Fix:** Add one persistent, quiet destination cue to phase rows and reserve the footer link for the full-competition destination.

**Suggested command:** `$impeccable clarify`

### [P2] Essential notation is too small

**Why it matters:** Q/E/F, JUN, LIVE, and NOC use 9–10px text. It is technically compact but weak for quick reading in a sports hall.

**Fix:** Keep secondary badges small, but raise stage, NOC, rank, and score to the readable compact baseline.

**Suggested command:** `$impeccable typeset`

## Persona Red Flags

- **Active shooter on a phone:** In a collapsed event, sees a score but not its phase, rank, athlete, flag/NOC, or whether it is qualification versus final.
- **Coach comparing results:** A completed event can preview qualification despite a final being available, risking an incorrect immediate conclusion.
- **First-time supporter:** `Q`, `E`, `F`, and `+2` have no visible legend; the accessible label helps assistive technology but not a sighted newcomer.

## Minor Observations

- Long names can still create irregular wrapping in `inlinePlaces()`; this should be assessed with a live 375px viewport, not redesigned from source alone.
- Lead-card metadata can truncate location when LIVE and level badges coexist.
- Reduced-motion handling correctly neutralizes the disclosure animation.

## Questions to Consider

- Should a collapsed event always surface F, then E, then Q, instead of whichever phase is first in the source array?
- Is the collapsed number a navigation hint or a result claim? If it is a claim, should it ever omit phase, rank, athlete, and NOC?
- Is compact `Q` / `E` / `F` sufficient for supporters, or should homepage phase names use short Serbian labels?
