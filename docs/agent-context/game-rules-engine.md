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

Block dice use **Parallel Universes** as the only player-facing resolution
model. The retired outcome checklist and `blockBranching` preference no longer
select a second rules path. Internally the implementation retains its branch
types/files: a block creates one playable universe per distinct live resulting
board, turnover mass is dead, and every universe must score or be conceded
before the run completes. Legal actions replay across lockstep siblings only
while they add no more rolls than the action authored on the viewed board. If a
sibling would introduce another dodge, Rush, pickup, or other roll, none of
that action is recorded there: it leaves lockstep as **Needs a plan** at the
pre-action state. The score is the summed weight of scoring universes. Series
submissions carry the same tree as individual submissions so
`shared/scoreValidation.js` recomputes the expected-value score and fractional
dice tie-break.

- A plain Block targets an adjacent standing opponent without movement.
- A Blitz chooses a reachable standing opponent first, moves into contact,
  resolves the block and any follow-up, then may spend its remaining movement.
  It is limited to one per team turn and is unavailable when no standing
  opponent is reachable by the attacker's movement (`blockActionAvailability`
  runs the same `computeReachable` contact check as `handleBlockAction`, not
  just "does a standing opponent exist anywhere on the pitch"). A plain Block
  remains available afterward.
- Effective Strength includes eligible assists adjacent to the opposing block
  participant. An assister marked by any other standing opponent is ineligible;
  the two players directly involved in the block do not cancel assists.
  Downed players neither assist nor exert tackle zones and cannot be selected
  or targeted.
- The branching block preview exposes that calculation directly: each player's
  base ST plus eligible assists, effective ST versus effective ST, and whether
  the resulting 1–3 dice are even, uphill, or downhill. It is an outcome
  preview, not a face-selection step: live board states name the die faces that
  produce them, turnover names every face that ends the drive, and **Progress**
  commits the split.
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
- **Deselecting the piece mid-post-Blitz leftover movement is a pause, not a
  cancel.** `blitzResumeId` marks a piece whose block has resolved but hasn't
  spent (or finished spending) its remaining movement. Clicking off it and
  reselecting it must resume with the MA/GFI it actually had left —
  `ActivationSnapshot.remainingMa`/`remainingGfi` preserve that across the
  deselect. Without it, `clearSelection` wiped `blitzResumeId` and reset
  `remainingMa` to 0, so reselecting the same piece granted a fresh full MA
  pool (#191).
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

- Guard is not modelled, so a marked player with Guard cannot assist.
- No armour or injury rolls; `down` is the only knocked-over state.
- No chain pushes: if every push-back square is occupied, the defender stays
  put and still falls.
- Failed rolls aren't simulated — the model tracks the probability of the whole
  line succeeding, so play continues as though every roll passed.

## Dodge Skill Reroll

A player with the `Dodge` skill has one reroll shared by all dodge tests in
that activation. It is not assigned to the first or hardest dodge. The rules
engine carries the probability that the reroll is still available across each
committed movement step, including separate clicks, so a line with dodge
success chances `p1..pn` is scored exactly as:

`product(p1..pn) * (1 + sum(1 - pi))`

This is the probability that every dodge succeeds with at most one initial
failure. Each dodge remains one action-log entry and is marked when the Dodge
skill contributes; the skill does not add another leaderboard `diceCount`.

## Performance

`findShortestPath` runs on every mouse-move over the pitch. It uses a binary
min-heap (`MinHeap` in `bfs.ts`) with parent pointers, not a re-sorted array
with a copied path per node. `Pitch.tsx` memoizes each `Square`, since only a
few of the 390 change between frames.

Committed movement is shown as a dashed white trail with an arrow just before
its final square, keeping the direction visible rather than burying the arrow
under the destination token. It is derived from the move entries in
`actionLog`. The route therefore
remains visible after an activation ends, disappears automatically when a
cancelled activation rolls back its log, and uses every individual step
(including diagonals) rather than only the waypoint destinations in
`committedPath`.

Each piece's first move this turn also gets a numbered circle on the square it
moved *from*, numbered by activation order (`movementTrail.ts`'s
`buildMovementStartMarkers`, rendered as `.trail-start-marker` in `Pitch.tsx`).
It is one number per piece, not per move segment — a piece that moves, does
something else, then moves again from a different square keeps its original
number. The marker is suppressed on a square that is occupied or already
carrying a dice/block marker, so it never contests the same square's centre.

Completed passes are also derived from `actionLog`, but render as a single
curved amber trajectory with an arrowhead across the pitch. The curve is
orientation- and zoom-aware and deliberately differs from the segmented white
movement trail, so a throw and a run remain distinguishable when they cross.

A resolved block/blitz shows its actual outcome (`BlockLogEntry.resolvedFace`,
e.g. "Push Back", "Defender Down") as a small crimson marker on the
defender's square (`BlockLogEntry.to`), reusing the same per-square marker
pattern as the dodge/GFI/pick-up dice: a `Map<string, BlockOutcomeFace>` built
from `actionLog` block entries (`Pitch.tsx`'s `committedBlockDiceMap`), so the
marker persists after the activation ends and disappears automatically if a
cancel rolls the block entry back out of the log. A square blocked more than
once in a turn (defender not pushed off it) shows only the most recent
block's outcome, matching the movement-dice overwrite-on-repeat convention.
`BlockDiceGraphic.tsx`'s `BlockFaceGraphic` renders the resolved-face marker;
its sibling `BlockDiceGraphic` is a pre-roll preview that animates each die
as an independently randomized downward throw: drift, timing, spin, bounce,
and shuffled settling face vary per die while all five face types remain in
the preview. It falls back to a static Push face under `prefers-reduced-motion`.
Both use the generated worn-iron WebP faces in
`assets/block-dice/`; picker advantage remains a CSS outline rather than a
second image set. No single face is "the" result yet.

A resolved push (push / defender-stumbles-falls / defender-down with a legal
push square) also draws a pushed-from/pushed-to indicator: an ice-blue arc
with an arrowhead between the two squares (`Pitch.tsx`'s `pushIndicators`,
reusing `passTrajectoryPath`), plus a soft ice-blue glow on both squares
(`.square--push-origin` / `.square--push-destination`). The destination is
recorded on the block's own `BlockLogEntry.pushTo` field, set by
`applyPushChoice` once the player picks a push-back square — `to` stays the
defender's *pre*-push square (see above), so the pair `to` → `pushTo`
describes the whole push. Same actionLog-derived, persists-after-activation,
clears-on-cancel convention as the trail/dice/block-outcome markers, and
deliberately coexists with the resolved-face marker on the origin square
rather than displacing it.

## Tests

| File | Covers |
|---|---|
| `bfs.test.ts` | pathfinding, reachability, roll targets, pass ranges, block dice, pushes |
| `useGameState.test.ts` | pass/handoff regressions, loose-ball pickup, touchdowns |
| `blockBlitz.test.ts` | block/blitz targeting, assists, outcomes, pushes, follow-ups |
| `BlockSplitPanel.test.tsx` | possible outcomes, turnover faces, ST/assist arithmetic, uphill/downhill dice |
| `activationRollback.test.ts` | cancel-rewind, ball-drop-on-knockdown, blitz movement cost |

Run everything (lint + shared + client + build) from the repo root:

```bash
npm run verify
```

When changing movement, pass, handoff, activation, or touchdown behavior, add or
update tests before relying only on manual play.
