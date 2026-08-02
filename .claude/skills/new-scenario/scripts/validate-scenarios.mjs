#!/usr/bin/env node
/**
 * Run the repo's own scenario validator over one draft, or over every shipped
 * scenario plus the series, before anything is committed.
 *
 * `shared/scenarioValidation.js` is the single source of truth the client editor,
 * the Express editor and the Netlify function all import — checking against it
 * here is what stops a hand-written JSON file from being accepted locally and
 * rejected with a 400 in production.
 *
 *   node .claude/skills/new-scenario/scripts/validate-scenarios.mjs            # everything
 *   node .claude/skills/new-scenario/scripts/validate-scenarios.mjs draft.json # one file
 *
 * Exits non-zero if anything fails, so it can gate a commit.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'shared', 'scenarioValidation.js'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('Could not find the repo root (no shared/scenarioValidation.js above this script).');
}
const ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const {
  normalizeScenario, validateScenario, normalizeSeries, missingSeriesScenarioIds,
} = await import(pathToFileURL(join(ROOT, 'shared', 'scenarioValidation.js')).href);

const SCENARIO_DIR = join(ROOT, 'client', 'src', 'scenarios');
const shipped = readdirSync(SCENARIO_DIR).filter(f => f.endsWith('.json'));
const shippedIds = shipped.map(f => basename(f, '.json'));

const arg = process.argv[2];
const files = arg
  ? [resolve(arg)]
  : shipped.map(f => join(SCENARIO_DIR, f));

let failed = false;
const seenSquares = [];
for (const file of files) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const scenario = normalizeScenario(raw);
  // A file already living in client/src/scenarios/ is allowed to own its own id;
  // a draft anywhere else claiming that id would collide on the way in.
  const inPlace = dirname(file) === SCENARIO_DIR;
  const others = new Set(inPlace ? shippedIds.filter(id => id !== scenario.id) : shippedIds);
  const errors = validateScenario(scenario, others);

  // Things the shared validator does not check but that break the puzzle.
  const extra = [];
  const active = scenario.pieces.filter(p => p.team === scenario.activeTeam);
  if (!scenario.pieces.some(p => p.hasBall) && !scenario.ballPosition) extra.push('no ball on the board');
  if (active.length && !scenario.pieces.some(p => p.hasBall && p.team === scenario.activeTeam) && !scenario.ballPosition) {
    extra.push('the ball belongs to the defending team and is not loose — the puzzle is unwinnable');
  }
  if (raw.published === undefined) extra.push('no "published" field — it will default to published');
  for (const piece of scenario.pieces) {
    if (piece.ma < 1) extra.push(`${piece.id} cannot move (MA ${piece.ma})`);
  }

  const label = basename(file);
  if (errors.length || extra.length) {
    failed = true;
    console.log(`FAIL ${label}`);
    for (const e of errors) console.log(`   error: ${e}`);
    for (const e of extra) console.log(`   warn:  ${e}`);
  } else {
    console.log(`ok   ${label} — ${scenario.pieces.length} players, ` +
      `${scenario.ballPosition ? 'loose ball' : 'carried ball'}, ${scenario.published ? 'published' : 'DRAFT'}`);
  }
  seenSquares.push(scenario.id);
}

if (!arg) {
  const seriesPath = join(ROOT, 'client', 'src', 'series', 'default.json');
  const series = normalizeSeries(JSON.parse(readFileSync(seriesPath, 'utf8')));
  const missing = missingSeriesScenarioIds(series, shippedIds.map(id => ({ id })));
  const unlisted = shippedIds.filter(id => !series.scenarioIds.includes(id));
  console.log(`\nseries "${series.name}": ${series.scenarioIds.length} puzzles`);
  if (missing.length) { failed = true; console.log(`   error: series lists ids that do not exist: ${missing.join(', ')}`); }
  if (unlisted.length) console.log(`   note:  scenarios not in the series: ${unlisted.join(', ')}`);
}

process.exit(failed ? 1 : 0);
