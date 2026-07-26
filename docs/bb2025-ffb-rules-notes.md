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
