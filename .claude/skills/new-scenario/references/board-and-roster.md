# Board, roster and engine reference

Everything here is checked against the code rather than the BB2025 rulebook — the
engine has deliberate simplifications, and a scenario built on the rulebook rather
than the engine will not price the way you expect.

## Coordinates

Scenario JSON uses **portrait** coordinates:

- `col` 0–14 (15 wide), `row` 0–25 (26 long)
- **Humans score on row 0. Orcs score on row 25.** (`isTouchdownSquare`)
- The gameplay pitch renders landscape — portrait `{col, row}` displays as
  `{col: row, row: col}`. Square labels in the UI read `<row><column letter>`, so
  `{col: 7, row: 5}` is the square labelled **5H**. Do not eyeball positions from
  a screenshot without applying that transform.
- Wide zones are cols 0–3 and 11–14; the centre is 4–10. Useful for making a
  formation look like a real setup.

## Movement economy (one turn, one activation each)

- A piece moves up to `ma` squares, plus **2 Go For It steps** at 2+ each.
- Diagonals cost the same as orthogonals, so a sideways detour is free in step
  count — a defender only makes a lane expensive if their tackle zone is on it.
- **A dodge is rolled when *leaving* a square in an opponent's tackle zone**, not
  when entering one. Target = `6 - AG` + tackle zones on the destination, clamped
  to 2–6. This is the single most misread rule when placing defenders.
- Loose-ball pickup: `6 - AG` + tackle zones on the ball's square, clamped 2–6.
  A piece may pick up and then pass or hand off in the same activation.
- Downed players still occupy their square but exert no tackle zone and give no
  assists.
- One pass **or** handoff per turn, total, for the whole team. One blitz per turn;
  plain blocks are unlimited.
- Receiving a pass or handoff does **not** mark the receiver activated. An unmoved
  receiver can catch and then run the ball in — usually the strongest line on any
  board with a spare receiver.

## Stat encoding

Roster stats are stored the way the engine consumes them, which is not how BB2025
prints them (see `client/src/editor/playerTemplates.ts`):

| Field | Stored as |
|---|---|
| `ma` | as printed |
| `st` | as printed |
| `ag` | **6 minus the printed target** — AG 3+ → `3`, AG 4+ → `2` |
| `pa` | the printed target — PA 3+ → `3` (lower is better) |
| `av` | printed minus 1 — AV 9+ → `8`. Display only; armour is never rolled |

All five must be integers 1–12 or the validator rejects the file.

## Roster templates

Copy these rather than inventing stat lines — the series reads as one team when
the numbers are consistent.

| Template | role | ma | st | ag | pa | av | skills |
|---|---|---|---|---|---|---|---|
| Human Thrower | `thrower` | 6 | 3 | 3 | 3 | 8 | Pass, Sure Hands |
| Human Catcher | `catcher` | 8 | 3 | 3 | 4 | 7 | Catch, Dodge |
| Human Lineman | `lineman` | 6 | 3 | 3 | 4 | 8 | — |
| Human Blitzer | `blitzer` | 7 | 3 | 3 | 4 | 8 | Block, Tackle |
| Orc Lineman | `lineman` | 5 | 3 | 3 | 4 | 9 | — |
| Orc Blitzer | `blitzer` | 6 | 3 | 3 | 4 | 9 | Block, Break Tackle |
| Orc Thrower | `thrower` | 6 | 3 | 3 | 3 | 8 | Pass, Sure Hands |
| Big Un Blocker | `big-un` | 5 | 4 | 2 | 6 | 9 | Mighty Blow, Taunt, Thick Skull, Unsteady |

## Roles that have art

A role with no portrait silently falls back to the team default, which looks like
a mistake on the pitch (`Pitch.tsx`, mirrored in `PlayerPanel.tsx`):

- **human**: `thrower`, `catcher`, `lineman`, `blitzer`, `blocker`, `guard`, `tackle`
- **orc**: `thrower`, `catcher`, `lineman`, `blitzer`, `blocker`, `black-orc`, `big-un`

`halfling`, `ogre`, `goblin` and `troll` exist as templates but have no art yet.

## Skills the engine actually reads

Everything else is flavour — it shows in the player panel and changes nothing:

- **Block** — attacker stays up on Both Down, so Both Down becomes an acceptable
  outcome. Worth two extra die faces on the checklist; it moves a 2-dice block
  from 88.9% to 97.2%.
- **Wrestle** — puts both players down, including a defender with Block.
- **Dodge** (on the defender) — Defender Stumbles becomes a push rather than a
  knockdown, unless the attacker has **Tackle**.
- **Tackle** (on the attacker) — cancels the defender's Dodge above.

`Pass`, `Sure Hands`, `Catch`, `Break Tackle`, `Mighty Blow` and friends are not
implemented. Do not build a puzzle whose solution depends on them.

## Block dice and assists

- Effective strength = own ST + **flat count of adjacent standing team-mates**
  (no Guard doubling, and assisters who are themselves marked still count).
- `>2×` → 3 dice, `>` → 2 dice, equal → 1 die, and the mirror for the defender.
- Die faces: Attacker Down 1, Both Down 1, **Push 2**, Defender Stumbles 1,
  Defender Down 1. Push being two faces is why accepting it is so cheap.
- Attacker picks → `1 − (1 − faces/6)^dice`; defender picks → `(faces/6)^dice`.
- A knocked-down carrier drops the ball where they land, creating a new loose ball.

## Names in the pool

Humans: Aldric Swiftfoot, Bramm Surehands, Cedric Linebreaker, Dieter Longstride,
Edwin Brighthelm, Franz Quickstep, Garran Ballwise, Hugo Ironlace, Jorek Fleetmark,
Kasper Dawnboot. (Sera Quickhand is established in the series as the star catcher.)

Orcs: Grukk Ironjaw, Muzgash Skullkrak, Vrak Bonecruncher, Dorg Gutripper, Skrag
Headsmash, Zug Bloodfang, Rukbad Bootsnappa, Gorzag Teefgrinda, Nobgul Linebasher,
Throg Chainbellow.

Reusing a name is good — the same Orcs turning up drive after drive is what makes
the series feel like a season. Keep a character's role consistent when you do.
