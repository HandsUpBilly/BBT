# BB2025 FFB Rules Notes

These notes capture the FFB rule translation used by this project so we do not need to re-pull and rediscover the same pass baseline.

Reference repository:
- https://github.com/christerk/ffb
- Reference clone inspected at FFB HEAD `3aac9bbca084c87cf376fa218494bab1d0e46340`

Relevant FFB files:
- `ffb-common/src/main/java/com/fumbbl/ffb/mechanics/bb2025/PassMechanic.java`
- `ffb-common/src/main/java/com/fumbbl/ffb/PassingDistance.java`
- `ffb-server/src/main/java/com/fumbbl/ffb/server/step/bb2025/pass/StepPass.java`
- `ffb-server/src/main/java/com/fumbbl/ffb/server/step/bb2025/pass/StepHandOver.java`
- `ffb-server/src/main/java/com/fumbbl/ffb/server/step/bb2025/shared/StepCatchScatterThrowIn.java`

## Passing Baseline

The project targets Blood Bowl Third Season Edition / BB2025.

FFB BB2025 uses a range-ruler table for pass bands, not a simple Chebyshev distance rule. The local implementation stores that table in `client/src/bfs.ts` as `BB2025_THROWING_RANGE_TABLE`.

Range penalties:

| Band | Penalty |
|---|---:|
| Quick Pass | +0 |
| Short Pass | +1 |
| Long Pass | +2 |
| Long Bomb | +3 |

Pass target:

```ts
target = max(2, min(6, pa + rangePenalty + tackleZoneCount))
```

`tackleZoneCount` counts opposing tackle zones covering the passer's square.

Current puzzle simplification:
- Accurate pass success transfers to a receiver catch roll.
- Failed pass is treated as a turnover/no submission.
- Inaccurate, fumble, scatter, interception, deflection, and loose-ball continuation are not simulated yet.
- Natural 6 success is represented by clamping high targets to `6+` for probability display.

## Hand-Off Baseline

FFB BB2025 models hand-off as `HAND_OVER` / `HAND_OVER_MOVE`, then routes the ball into `CATCH_HAND_OFF`.

Current puzzle simplification:
- Hand-off shares the `passUsed` flag with passing.
- Receiver makes the same accurate-ball catch target used by passes:

```ts
target = max(2, min(6, (6 - receiverAg) - 1 + tackleZoneCount))
```

`tackleZoneCount` counts opposing tackle zones covering the receiver's square.

## Block and Assist Baseline

Written so the weekly review's "compare the engine against the rules notes" step
has something to compare blocks against; passing and hand-off previously had a
baseline here and blocks did not, which is why an assist-eligibility change
shipped with nothing to check it against.

**Source caveat:** unlike the passing and hand-off sections above, this baseline
was *not* read out of an FFB clone. It states the BB2020/BB2025 tabletop rule and
the engine's current behaviour side by side. Treat the rule column as the
authority on intent and the FFB source as still un-pulled — pulling
`ffb-server/.../block/` and `ffb-common/.../mechanics/bb2025/` to confirm the
edge cases is outstanding work, not a settled question.

### Dice count and who picks

From effective Strength — own ST plus eligible assists — on each side:

| Comparison | Dice | Picker |
|---|---:|---|
| attacker > 2 × defender | 3 | attacker |
| attacker > defender | 2 | attacker |
| equal | 1 | — |
| defender > attacker | 2 | defender |
| defender > 2 × attacker | 3 | defender |

Implemented in `blockDiceCount` (`client/src/bfs.ts`), which matches this table.

### Assist eligibility

The rule: a teammate adjacent to the opposing block participant lends one
assist, unless that teammate is itself marked by a standing opponent *other
than* the player it is assisting against. The two players in the block do not
cancel assists — the attacker does not cancel the defender's assists, and the
defender does not cancel the attacker's. Prone and stunned players neither
assist nor exert a tackle zone.

`countEligibleAssists` implements exactly that, including the
other-than-that-participant exclusion. This is the behaviour 86bdd70 corrected.

**Guard is not modelled.** On the tabletop, Guard lets a player assist even when
marked. Here a marked assister is ineligible regardless of skills, so any
scenario giving a piece Guard will under-count assists. Deliberate simplification,
not a defect — but it is the first thing to check if a scenario's dice count
looks a die short.

### Outcome faces

Six physical faces over five outcomes: Push occupies two, the other four one
each. `BLOCK_FACE_WEIGHTS` in `bfs.ts` encodes that, and the puzzle's
outcome-checklist model turns an accepted subset into a probability:

- attacker picks → `1 − (1 − p)^dice` (any die may match)
- defender picks → `p^dice` (every die must match)

Skill interactions the engine does model:

- Attacker Down is displayed but can never be accepted as a success.
- Both Down is acceptable only when the attacker has Block or Wrestle.
- Block keeps its owner standing on Both Down; Wrestle (attacker lacking Block)
  puts both players down, including a defender with Block.
- On Defender Stumbles the defender stays up if it has Dodge and the attacker
  lacks Tackle; otherwise it falls.
- A knocked-down carrier drops the ball on the square it ends up on, push
  destination included. Scatter is not simulated.

### Not simulated

Armour, injury and casualty rolls — `down` is the only knocked-over state.
Crowd pushes. Occupied push arcs do support recursive chain pushes, but a route
that can only leave the pitch is not offered.

**Block resolution reads exactly four skills** — Block, Wrestle, Dodge and
Tackle (the only `skills.includes` calls in `useGameState.ts`). Every other
skill a scenario can give a piece, Guard and Frenzy included, is presentational:
it renders on the player card and changes nothing in the resolution.
