---
name: audit-scenario
description: Enumerate and price every way the active team can score in a BBT puzzle — runs, passes, handoffs, blitzes, and the block openings that unlock them — using the repo's own rules engine. Use this whenever someone asks how a scenario can be solved, what the best line is, whether a puzzle is too easy, too hard, unsolvable, or unbalanced, whether a route exists at all, or wants two scenarios compared. Use it on every scenario you create or edit before calling it done, and any time you are about to state a probability for a Blood Bowl puzzle — work the odds out with the tool rather than by hand, because hand maths misses acceptable block faces and the fact that a receiver still has their move after catching.
---

# Auditing a puzzle's winning lines

A BBT puzzle is exactly one turn, and the score *is* the cumulative probability of
the rolls you commit to. So "is this a good puzzle?" is a question about the
distribution of scoring lines: how many there are, how far apart they are, and
whether the best one rewards insight or just legwork.

`scripts/audit-scenario.mjs` answers that. It imports `client/src/bfs.ts` directly
(Node strips the types on load), so dodge, pickup, catch and pass targets, the
BB2025 range ruler, block dice, assists and push-back arcs come from the same code
the game runs. Only the *search* — which sequences of activations are worth
pricing — lives in the script.

## Running it

```bash
node .claude/skills/audit-scenario/scripts/audit-scenario.mjs scenario-006
```

It takes a scenario id or a path to any JSON file in scenario shape, so it works
on drafts that are not in `client/src/scenarios/` yet.

| Flag | Effect |
|---|---|
| `--top N` | how many lines to rank (default 12) |
| `--explain N` | roll-by-roll breakdown of the top N (default 3) |
| `--no-blitz` | skip blitz openings — much faster while iterating on a layout |
| `--all-blocks` | price blocks on defenders that are marking nothing, too |
| `--json` | machine-readable output |

A 16-player board takes ~25s because every opening reshapes the board and forces a
fresh search. Use `--no-blitz` while you are moving pieces around, then a full run
before you commit.

## Reading the output

Routes are named for the mechanic that finishes the play:

- **RUN** — the carrier crosses the line themselves.
- **PASS** / **HANDOFF** — a team-mate walks into the end zone first and receives
  the ball there. Catching in the end zone scores.
- **THROW+RUN** / **PITCH+RUN** — the ball goes to a team-mate who *has not moved
  yet*, who then runs it in. Catching does not mark a receiver activated, so this
  is often the cheapest line on the board and the one players miss.
- **BLITZ+RUN** — the blitzer knocks someone over and carries on with the movement
  it has left.

The `opening` column is the block (if any) that reshaped the board first. Blocks
come in three readings because of how the outcome checklist works — the engine
charges you for every face you tick but lets you continue from whichever ticked
face you like:

- **down · tight accept** — only the faces that actually knock the defender over.
  Lower odds, guaranteed board state.
- **down · wide accept** — Push ticked as well, still resolved as a knockdown.
  Higher odds, and legal; this is what a leaderboard run does.
- **push · wide accept** — the same price, but the pessimistic board where the
  defender is merely shoved and still has a tackle zone.

The footer gives the best line, how many lines sit within 25% of it and across how
many different mechanics, and the best line available with no block at all. That
last number is the one that tells you whether the line play is a real decision or
a mandatory tax.

## What the numbers mean for a puzzle

- **Best line 60–70%** is an opening-level puzzle; **20–30%** is a hard one.
  `scenario-001` audits at 69.4% and `scenario-004` at 23.1% — use them as anchors.
- **Several mechanics within 25% of the best line** is the sign of a puzzle worth
  playing: the coach picks a plan rather than executing the only one.
- **One line far ahead of everything else** means the puzzle has a single solution.
  That is fine for a teaching puzzle, dull as a ranked board.
- **A large gap between the best line and the best no-block line** means the block
  is compulsory. One compulsory block that teaches "clear the tackle zone before
  you pick up" is good; a puzzle where nothing works without three of them is not.
- **NO SCORING LINE FOUND** means nobody can reach the end zone this turn. Check
  the ball is reachable and the carrier has the movement.

## Known model limits

Printed with every run, and worth repeating because they are where the tool can
mislead you:

- Chain pushes, follow-up moves after a Defender Down, and armour/injury rolls are
  not simulated (the engine does not roll armour either).
- Pushes are sent to the square furthest from the ball; the engine lets the player
  pick any square in the arc.
- The receiver's run in PITCH+RUN / THROW+RUN is searched without the deliverer's
  final square blocked, and a receiver waiting in the end zone is not treated as
  blocking the carrier across that one square. Both are single-square effects.
- Only the cheapest approach square is considered for a blitz.

If a line matters — you are about to publish a puzzle around it — walk it once in
the app to confirm the tool and the game agree.
