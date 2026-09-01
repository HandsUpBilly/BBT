# Scenarios And Series

Primary files:

- `client/src/scenarios/*.json`
- `client/src/scenarios/index.ts`
- `client/src/series/*.json`
- `client/src/series/index.ts`
- `client/src/types.ts`

## Scenario Shape

`Scenario` fields:

- `id`
- `name`
- `description`
- `activeTeam`
- `objective` (`touchdown` today; the field is deliberately extensible)
- `freePlay` (whether the puzzle also appears as a standalone match)
- `published?: boolean`
- `ballPosition?: Position | null`
- `pieces`

`ScenarioPieceDef` includes fixed stats, role, skills, position, and `hasBall`.

## Published Puzzles

`client/src/scenarios/index.ts` exports:

- `allScenarios`: every JSON puzzle.
- `scenarios`: only puzzles where `published !== false`.

Normal player-facing screens should use `scenarios`. Admin/editor flows may use
all puzzles.

## Naming

Scenario JSON `name` and `description` are the source of truth for challenge
tiles and leaderboards. Do not add screen-specific copy maps.

## Ball State

Exactly one ball per puzzle, either:

- carried: exactly one piece with `hasBall: true`, or
- loose: a `ballPosition`.

Loose-ball pickup **is** implemented: walking onto the ball's square adds an
Agility test (`pickupTargetAt`) that folds into the probability chain, and a
piece can pick up and then pass/hand off in the same activation. A knocked-down
carrier also drops the ball, creating a new loose ball mid-run.

## Validation

`shared/scenarioValidation.js` is the single source of truth for scenario shape
— id format, stat ranges (1–12), pitch bounds, one-ball-only, and at least one
player on the active team. The client editor, `server/editor.js`, and
`netlify/functions/editor-scenarios.js` all import it. Do not fork it: the
client used to have its own looser copy, so the editor accepted drafts the
server then rejected with a 400.

## Series

Series metadata lives in `client/src/series/*.json`. Each definition has a
stable id, title/name, short player-facing category `label`, description, two
teams, objective, uploaded logo, zero-based display `order`, enabled/published
state, and an ordered `scenarioIds` step list. The chooser derives the numeric
prefix from actual list position, displays that label, renders the stored
objective, and uses a generic Play action.
Disabled series remain saved in Admin Mode but are removed from the
player-facing public view. A puzzle can be in at most one series; Series Creator
is the authoritative place to add, remove, and reorder puzzle membership, and
rejects attempts to add a puzzle already owned by another series.
Both scenarios and series may also set `adminEnabled: true`. The public endpoint
uses only `published !== false`; confirmed admins securely load the union of
public and admin-enabled content from the protected editor endpoint. Records
with both flags off remain visible only inside the Creator.
Saving a series also validates the BB2025 positional composition of every
assigned puzzle, so legacy or production-only boards with excess positionals
must be corrected before the series can be saved.

Scenario JSON remains the source of truth for the puzzle name and description.
Descriptions use an OBJECTIVE clause followed by the rules needed to read the
board. Keep this copy factual. Do not prescribe a single solved route unless
the puzzle itself requires that action.

The default series is player-facing **Humans vs Orcs: The Nuffle Shuffle**, is
labelled as a Tutorial in the challenge screen, and uses this rules order:
`scenario-001`, `scenario-004`, `scenario-002`, `scenario-003`,
`scenario-005`, `scenario-006` (movement, dodging, handoff, pass, combined
play, then the unrestricted full-action board). The chooser presents that
canonical teaching order but permits unfinished drills to be played in any
order. Completed drills can also be replayed; the new result replaces the
earlier result in place so the series always contains one result per scenario.
The chooser returns after every non-final drill and shows a neutral recap of
the last run's tactical action sequence and probability. Compact objective
copy remains in `client/src/tutorialLessons.ts`; stable concept definitions,
automatic/manual modes, diagrams, and per-scenario concept lists live in
`client/src/tutorialConcepts.ts`. Neither overrides scenario names or
descriptions, and neither adds fields to scenario JSON. Every Tutorial drill
exposes all actions that are currently legal under the game rules; lesson order
does not gate the action menu. Persistent Introduced/Used concept progress
prevents repeated automatic teaching across drills, while a completed-drill
replay asks whether guidance should replay. The same concept library and
contextual guidance are available when a drill is launched individually.
Series definitions may include a client-processed 256×256 WebP data URL uploaded
in Series Creator. PNG, JPEG, and WebP source files are accepted, cropped to a
square, stripped of source metadata, and bounded before save. The chooser also
resolves the legacy `nuffle-shuffle` built-in key; an omitted logo retains the
text-only fallback.
The short label is rendered after the automatically derived two-digit list
position, so admins control “Series” in “02 Series” without hand-maintaining
the numbering.

Saved series metadata can outlive a deployment in Netlify Blobs.
`normalizeSeriesDefinition()` maps the two known legacy featured-series names
to the current title and backfills the featured crest when older published
metadata has no `logo` field. The chooser always renders its `01` series marker
beside the crest, so the identity does not disappear during runtime loading.

`resolveSeriesScenarios()` in `client/src/series/index.ts` resolves series
`scenarioIds` to scenario objects. Series Play should use the resolved series
list, not all scenarios sorted by id.

### Dangling series ids

`resolveSeriesScenarios` silently skips ids that no longer resolve, which would
shorten a series run without explanation. Two guards exist:

- The **player-facing views** (`toPublicView` on Netlify, `readPublicScenarios`
  locally) narrow `series.scenarioIds` to scenarios that survive the
  `published !== false` filter, so disabling a puzzle can't silently truncate a
  live series.
- Deleting a puzzle removes it from every draft series in the same operation.

When changing series behavior:

- Update the relevant series JSON if its order/content changes.
- Confirm `ScenarioSelect.tsx` displays the series metadata.
- Confirm `App.tsx` series counters use the resolved series length.

## Adding a Scenario

Drop the `.json` file in `client/src/scenarios/`. The client picks it up via
`import.meta.glob`; the Netlify Blobs seed is regenerated from the same files by
`scripts/generate-scenario-seed.mjs` during the build. No manual import
registration in either place — and never hand-edit
`netlify/functions/scenarioSeed.js`.
