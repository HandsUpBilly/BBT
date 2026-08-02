# Scenarios And Series

Primary files:

- `client/src/scenarios/*.json`
- `client/src/scenarios/index.ts`
- `client/src/series/default.json`
- `client/src/series/index.ts`
- `client/src/types.ts`

## Scenario Shape

`Scenario` fields:

- `id`
- `name`
- `description`
- `activeTeam`
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

Default series metadata lives in `client/src/series/default.json`.

`resolveSeriesScenarios()` in `client/src/series/index.ts` resolves series
`scenarioIds` to scenario objects. Series Play should use the resolved series
list, not all scenarios sorted by id.

### Dangling series ids

`resolveSeriesScenarios` silently skips ids that no longer resolve, which would
shorten a series run without explanation. Two guards exist:

- The **published views** (`toPublicView` on Netlify, `readPublicScenarios`
  locally) narrow `series.scenarioIds` to scenarios that survive the
  `published !== false` filter, so disabling a puzzle can't silently truncate a
  live series.
- The **editor** surfaces `missingSeriesScenarioIds()` as a warning with a
  "Remove Missing Entries" action.

When changing series behavior:

- Update `default.json` if the order/content changes.
- Confirm `ScenarioSelect.tsx` displays the series metadata.
- Confirm `App.tsx` series counters use the resolved series length.

## Adding a Scenario

Drop the `.json` file in `client/src/scenarios/`. The client picks it up via
`import.meta.glob`; the Netlify Blobs seed is regenerated from the same files by
`scripts/generate-scenario-seed.mjs` during the build. No manual import
registration in either place — and never hand-edit
`netlify/functions/scenarioSeed.js`.

