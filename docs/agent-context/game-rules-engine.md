# Game Rules Engine

Primary files:

- `client/src/useGameState.ts`
- `client/src/bfs.ts`
- `client/src/types.ts`
- `client/src/useGameState.test.ts`
- `client/src/Pitch.tsx`

## Coordinates

Game state uses portrait coordinates:

- `Position.col`: `0..14`
- `Position.row`: `0..25`

Gameplay pitch rendering maps those into a landscape display. Do not assume the
editor pitch and gameplay pitch use the same visual orientation.

## Core State

`makeScenarioState(scenario)` converts scenario JSON pieces into active game
pieces with `activated: false`.

Important `GameState` fields:

- `selectedPieceId`, `reachableKeys`, `pathPreview`
- `remainingMa`, `remainingGfi`
- `pendingDodgeTargets`, `pendingProb`
- `pendingHandoff`, `isHandoffTargeting`, `handoffTargets`
- `pendingPass`, `isPassTargeting`, `passRangeKeys`, `passReceiverKeys`
- `passUsed`: one pass/handoff resource per turn
- `pendingBlock`, `pendingBlockIsBlitz`, `isBlockTargeting`, `blockTargets`
- `blockChoice`, `pendingBlockResolution`, `pushTargetKeys`
- `blitzUsed`: one blitz resource per team turn
- `actionLog`: source for score probability and replay summary

## Pass / Handoff Invariants

Receivers may already be activated. Prior bugs filtered receivers by
`!piece.activated`; do not reintroduce that.

If a declared pass/handoff has no valid target after carrier movement:

- carrier activation ends,
- targeting state clears,
- `passUsed` is not consumed,
- no pass/handoff action entry is added.

Receiving a pass/handoff should not itself mark the receiver activated.

## Block / Blitz Invariants

- A plain Block targets an adjacent standing opponent without movement.
- A Blitz may move first, then targets an adjacent standing opponent, and is
  limited to one per team turn. A plain Block remains available after a Blitz.
- Effective Strength includes eligible adjacent assists. Downed players neither
  assist nor exert tackle zones and cannot be selected or targeted.
- Block dice use 1–3 dice from the effective-Strength comparison. The player
  chooses acceptable faces; probability is combined according to whether the
  attacker or defender picks the result.
- Push outcomes require a legal push-back square. Defender Down also offers the
  attacker a follow-up into the vacated square.
- The Block skill keeps its owner standing on a Both Down result.
- Block and Blitz resolutions are recorded as `block` action-log entries and
  contribute to cumulative probability and dice count.

## Tests

`client/src/useGameState.test.ts` covers pass/handoff regressions.
`client/src/blockBlitz.test.ts` covers block/blitz targeting, assists, outcomes,
pushes, follow-ups, turn limits, and probability math.

Run:

```bash
cd client && npm test -- --run
```

When changing movement, pass, handoff, activation, or touchdown behavior, add or
update tests before relying only on manual play.
