# Game Rules Engine

Primary files:

- `client/src/useGameState.ts`
- `client/src/bfs.ts`
- `client/src/types.ts`
- `client/src/Pitch.tsx`
- `client/src/{useGameState,blockBlitz,activationRollback,bfs}.test.ts`

## One Turn Only

A puzzle is exactly one turn. There is no End Turn, no turn counter, no halves,
and no running score — `GamePhase` is only `'playing' | 'touchdown'`. The
cumulative probability of the rolls you commit to *is* the score, so any
mechanism that resets the turn would also reset the score. The old multi-turn
machinery (`handleEndTurn`, `advanceTurn`, `PhaseModal`, Free Play) was never
wired to any UI and has been deleted; don't reintroduce it.

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
- `activationLogStart`, `activationSnapshot`: the cancel-rollback pair
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

## Cancel Must Rewind the Board, Not Just the Log

Several sub-steps commit to `pieces`/`ballPosition` *before* the activation
finishes: Blitz movement, and loose-ball pickup ahead of a pass/handoff.

`clearSelection(state, true)` therefore restores `activationSnapshot` (taken by
`beginActivation`) as well as truncating `actionLog` to `activationLogStart`.

Truncating only the log refunded the probability cost of the movement while
leaving the piece at its new square and still unactivated — a free-movement
exploit directly against the score. `resumeMovementAfterBlitz` re-baselines the
snapshot after a block resolves, so cancelling the leftover movement can't undo
a block that has already been paid for.

Regression tests: `client/src/activationRollback.test.ts`.

## Block / Blitz Invariants

- A plain Block targets an adjacent standing opponent without movement.
- A Blitz chooses a reachable standing opponent first, moves into contact,
  resolves the block and any follow-up, then may spend its remaining movement.
  It is limited to one per team turn and is unavailable when no standing
  opponent is reachable by the attacker's movement (`blockActionAvailability`
  runs the same `computeReachable` contact check as `handleBlockAction`, not
  just "does a standing opponent exist anywhere on the pitch"). A plain Block
  remains available afterward.
- Effective Strength includes eligible adjacent assists. Downed players neither
  assist nor exert tackle zones and cannot be selected or targeted.
- Block dice use 1–3 dice from the effective-Strength comparison. The player
  chooses acceptable faces; probability is combined according to whether the
  attacker or defender picks the result.
- **A knocked-down player drops the ball** on the square they end up on, which
  becomes a loose ball (scatter is not simulated). This applies to Attacker
  Down, Both Down, and any push that knocks the defender over — including the
  push destination. Without it, blocking the opposing carrier had no effect on
  the ball at all.
- **A Blitz block costs one square of movement**, deducted from `remainingMa`
  (or `remainingGfi`). Without it a blitzing piece effectively had MA + 1.
- Push outcomes require a legal push-back square. All three push-back results
  (Push, Defender Stumbles, Defender Down) offer the attacker a follow-up into
  the vacated square, since the attacker stays standing in each case.
- `blockActionAvailability` only offers Blitz when a standing opponent is
  actually reachable — checking merely that one exists left an enabled menu
  button that silently did nothing.
- Attacker Down is displayed but cannot be accepted as a successful outcome.
  Both Down can only be accepted when the attacker has Block or Wrestle.
- The Block skill keeps its owner standing on Both Down. Wrestle (when the
  attacker lacks Block) puts both players down, including a defender with Block.
- Block and Blitz resolutions are recorded as `block` action-log entries and
  contribute to cumulative probability and dice count.

## Known Rules Simplifications

Deliberate, and worth knowing before "fixing" them:

- Assists are a flat adjacency count — no Guard doubling, and no exclusion of
  assisters who are themselves marked. This makes dice counts optimistic in
  crowded positions.
- No armour or injury rolls; `down` is the only knocked-over state.
- No chain pushes: if every push-back square is occupied, the defender stays
  put and still falls.
- Failed rolls aren't simulated — the model tracks the probability of the whole
  line succeeding, so play continues as though every roll passed.

## Performance

`findShortestPath` runs on every mouse-move over the pitch. It uses a binary
min-heap (`MinHeap` in `bfs.ts`) with parent pointers, not a re-sorted array
with a copied path per node. `Pitch.tsx` memoizes each `Square`, since only a
few of the 390 change between frames.

## Tests

| File | Covers |
|---|---|
| `bfs.test.ts` | pathfinding, reachability, roll targets, pass ranges, block dice, pushes |
| `useGameState.test.ts` | pass/handoff regressions, loose-ball pickup, touchdowns |
| `blockBlitz.test.ts` | block/blitz targeting, assists, outcomes, pushes, follow-ups |
| `activationRollback.test.ts` | cancel-rewind, ball-drop-on-knockdown, blitz movement cost |

Run everything (lint + shared + client + build) from the repo root:

```bash
npm run verify
```

When changing movement, pass, handoff, activation, or touchdown behavior, add or
update tests before relying only on manual play.
