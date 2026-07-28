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

Current editor data supports:

- carried ball: exactly one piece with `hasBall: true`,
- loose ball: `ballPosition`.

Gameplay is strongest with carried-ball puzzles. Loose-ball gameplay pickup
rules are not fully built out yet.

## Series

Default series metadata lives in `client/src/series/default.json`.

`resolveSeriesScenarios()` in `client/src/series/index.ts` resolves series
`scenarioIds` to scenario objects. Series Play should use the resolved series
list, not all scenarios sorted by id.

When changing series behavior:

- Update `default.json` if the order/content changes.
- Confirm `ScenarioSelect.tsx` displays the series metadata.
- Confirm `App.tsx` series counters use the resolved series length.

