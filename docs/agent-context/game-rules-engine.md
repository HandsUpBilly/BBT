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

## Tests

`client/src/useGameState.test.ts` covers pass/handoff regressions.

Run:

```bash
cd client && npm test -- --run
```

When changing movement, pass, handoff, activation, or touchdown behavior, add or
update tests before relying only on manual play.

