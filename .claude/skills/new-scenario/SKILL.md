---
name: new-scenario
description: Author a new Blood Bowl puzzle for this repo — lay out a board that reads like a real drive, give it several genuinely different ways to score, price every line with the audit tool, validate it and register it in the series. Use this whenever someone asks for a new scenario, puzzle, play, board, level or challenge, wants an existing one made harder, easier or more interesting, wants a scenario built around a particular mechanic (a long bomb, a goal-line stand, a fumble, a blitz), or asks to add to the series. Reach for it before hand-writing scenario JSON — the coordinate system, the stat encoding and the roles that have artwork are all easy to get wrong, and an unbalanced board is not obvious by eye.
---

# Building a puzzle

A puzzle is **exactly one turn**. Each piece activates once, the run ends when the
ball crosses the line, and the cumulative probability of the rolls you committed to
*is* the score. Everything about designing a good board follows from that: there is
no recovering from a bad decision, so the interesting part is the decision itself.

Read `references/board-and-roster.md` before placing anything. It has the
coordinate system, the stat encoding (AG is stored as `6 − printed`), the roles
that actually have artwork, and the short list of skills the engine reads. Getting
those wrong produces a file that validates and then plays wrong.

## What makes a puzzle worth playing

A board with one solution is a maze; a board with several is a decision. Aim for
**three or four routes within about 25% of each other, using different mechanics** —
carry it in, pitch it to someone in space, throw it into the end zone, blitz a lane
open. The audit tool reports exactly this spread, so you can design against it.

Levers that create routes, roughly in order of usefulness:

- **A loose ball with one defender's tackle zone on it.** Every scooper pays the
  same pickup roll, so the puzzle becomes "how do I make that roll cheaper" — which
  is what the block is for. `scenario-006` is built on this.
- **A receiver in space.** Catching does not use up the receiver's move, so a pitch
  to an unmoved team-mate who then runs it in is often the best line on the board.
  Give them a covering defender two squares away and the coach has to notice.
- **A defender who is worth blocking.** Two friendly bodies next to the blocker and
  only one next to the target turns a coin-flip into a 2-dice block. A blocker with
  the Block skill can accept Both Down as well, which is 97.2% rather than 88.9%.
- **Distance tuned to the movement economy.** MA 6 reaching the line in exactly 8
  steps means two Go For It rolls; MA 8 covering the same ground pays nothing. That
  single square of difference is often the whole puzzle.
- **Lanes, not walls.** Defenders only cost the runner anything when their tackle
  zone sits on a square the runner must *leave*. Diagonal movement is free, so a
  gap in a wide zone makes a wall irrelevant.

Make it look like a real game while you are at it: a line of scrimmage with bodies
on both sides, receivers downfield, a corner on each flank and a deep safety. A
mid-play snapshot does not need to be a legal setup, and a scrum that has been
shoved around reads better than a tidy grid.

## Workflow

**1. Pick the id and the story.** Ids are `scenario-NNN`, lowercase and sequential.
The `name` and `description` in the JSON are the single source of truth for the
challenge tile *and* the leaderboard — there is no per-screen copy map, and one was
removed for causing exactly that drift. Write the description as a coach would
brief it, and name the players who are actually on the board.

**2. Sketch the board on paper first.** Write out the squares before the JSON:
which defender marks the ball, which lane is open, how many steps each candidate
carrier needs. Portrait coordinates, humans attacking row 0.

**3. Write `client/src/scenarios/scenario-NNN.json`.** Match the formatting of the
neighbouring files (stat lines kept on one line). Exactly one ball: either one
piece with `hasBall: true`, or a `ballPosition`, never both. Set `published: true`
deliberately — omitting it defaults to published.

**4. Audit it.** This is the step that turns a layout into a puzzle:

```bash
node .claude/skills/audit-scenario/scripts/audit-scenario.mjs scenario-NNN --no-blitz
```

Use the `audit-scenario` skill for how to read the output. Iterate here — move one
defender, rerun, watch the spread. Anchors: `scenario-001` audits at 69.4% (opening
puzzle), `scenario-004` at 23.1% (hard). Then run it once without `--no-blitz`
before you commit, because a blitz sometimes opens a line you did not intend.

**5. Validate.**

```bash
node .claude/skills/new-scenario/scripts/validate-scenarios.mjs
```

This runs `shared/scenarioValidation.js` — the same validator the editor and the
Netlify function use — over every scenario and the series, and adds a few checks it
does not make (no ball, unreachable ball, missing `published`).

**6. Register it in the series** if it belongs there: add the id to
`client/src/series/default.json`. Series order is play order.

**7. Regenerate the seed and verify.**

```bash
npm run generate:seed
npm run verify
```

`generate:seed` rewrites `netlify/functions/scenarioSeed.js`, which is how the
scenario reaches production — never hand-edit that file. `npm run verify` is the
only signal before a PR: there is no hosted CI.

**8. Look at it.** Start the client (`cd client && npm run dev`), open Single Plays
and check the formation reads like a game rather than a diagram. The pitch renders
landscape, so pieces will not be where the JSON coordinates suggest until you apply
the transform in the reference.

## Traps worth knowing

- **Deviating from the roster templates** makes the series feel inconsistent. If a
  puzzle needs a faster catcher, ask whether it really needs a different board
  instead.
- **A defender adjacent to the ball is the whole puzzle**, so decide deliberately
  whether it is one (pickup 4+) or two (5+ — usually too punishing).
- **Never leave the only route needing three or more risky rolls** unless the
  puzzle is explicitly the hard one in the series; the score falls off a cliff.
- **Check the no-block line** in the audit footer. If it is far below the best line,
  the block is compulsory rather than a choice — fine once, dull as a pattern.
- **Two pieces cannot share a square**, and a downed piece still occupies one.
