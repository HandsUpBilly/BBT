#!/usr/bin/env node
// Generates netlify/functions/scenarioSeed.js from client/src/scenarios/*.json.
//
// The client picks scenarios up with import.meta.glob, but esbuild (which
// bundles the Netlify functions) cannot glob, so the seed used on a Blobs
// store's first read needs a literal import list. Generating it keeps
// AGENTS.md's promise true: dropping a new JSON file in client/src/scenarios/
// is the only step required, in both environments.
//
// Run automatically by the Netlify build command and by `npm run build`.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scenarioDir = join(root, 'client/src/scenarios');
const seriesPath = join(root, 'client/src/series/default.json');
const outputPath = join(root, 'netlify/functions/scenarioSeed.js');

const files = (await readdir(scenarioDir))
  .filter(file => file.endsWith('.json'))
  .sort();

const scenarios = await Promise.all(
  files.map(async file => JSON.parse(await readFile(join(scenarioDir, file), 'utf8'))),
);
const series = JSON.parse(await readFile(seriesPath, 'utf8'));

const banner = `// GENERATED FILE — do not edit.
// Produced by scripts/generate-scenario-seed.mjs from:
//   client/src/scenarios/*.json  (${files.length} file${files.length === 1 ? '' : 's'})
//   client/src/series/default.json
// Regenerate with: npm run generate:seed
`;

const contents = `${banner}
export const STATIC_SCENARIOS = ${JSON.stringify(scenarios, null, 2)};

export const STATIC_SERIES = ${JSON.stringify(series, null, 2)};
`;

await writeFile(outputPath, contents);
console.log(`Wrote ${outputPath} (${scenarios.length} scenarios, ${series.scenarioIds?.length ?? 0} in series)`);
