#!/usr/bin/env node
// One-shot helper that stamped spec.md's feature sections with status markers
// and normalized their heading levels. Kept in the repo so the same treatment
// can be reapplied if the spec is ever restructured again.
//
// Usage: node scripts/annotate-spec.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const specPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec.md');

// Feature boundaries, identified by their exact heading text. Each becomes a
// top-level `#` section with a Status line beneath it.
const SECTIONS = [
  ['Issue and Feature Request Reporting', 'Shipped', 'Report launcher, modal, /api/reports, and the Markdown download fallback are live. Rate limiting was added later; see "Leaderboard and Report Integrity".'],
  ['Handoff Action', 'Shipped', 'Implemented in useGameState (handleHandoffAction/handleHandoffTarget) with tests in useGameState.test.ts.'],
  ['Pass Action', 'Shipped', 'Range table, pass/catch rolls, and range overlay are live in bfs.ts and useGameState.ts.'],
  ['Scenario 002 — The Handoff Play', 'Shipped', 'Lives at client/src/scenarios/scenario-002.json.'],
  ['Leaderboard — Move Summary on Row Click', 'Shipped', 'Both leaderboards persist `moves` and render ScoreSummary on row click.'],
  ['Leaderboard — Netlify Deployment', 'Shipped', 'See netlify/functions/leaderboard.js. NOTE: the storage section below says "top 10" while the API section says "top 20" — the shipped behavior is that the store keeps EVERY entry and only the read is truncated (10 on Netlify, 20 locally).'],
  ['Puzzle Mode', 'Shipped, with one deliberate divergence', 'Mode 2 (Puzzle Mode) is the whole game now. Mode 1 (Free Play) was removed: a puzzle is always exactly one turn, so the multi-turn loop, score, half, and turn counters no longer exist.'],
  ['Series Mode Specification', 'Shipped', 'See series/default.json, resolveSeriesScenarios, and the series leaderboard.'],
  ['Google Social Sign-On Plan', 'Shipped', 'Google Identity Services + guest identity, verified server-side via shared/googleAuth.js. Token expiry handling was added later (client/src/auth.ts isTokenExpired).'],
  ['Puzzle Editor / Creator Plan', 'Shipped', 'Including the piece inspector (stats, skills, team, role), puzzle-list metadata, and the missing-series-id warning, all of which were outstanding for a while. Local dev writes JSON files; Netlify uses Blobs drafts plus an explicit Publish.'],
  ['Bug Fix — Pass/Handoff fails when receiver already activated this turn', 'Shipped', 'Fixed; guarded by regression tests in useGameState.test.ts.'],
  ['Agent Context Documentation Plan', 'Shipped', 'docs/agent-context/ exists and is routed from AGENTS.md.'],
  ['Loose Ball Pickup', 'Shipped', 'Pickup rolls fold into the probability chain; see bfs.ts pickupTargetAt and the tests in useGameState.test.ts.'],
  ['Block and Blitz Actions', 'Shipped, with rules simplifications', 'Live. Two rules gaps were closed afterwards: a knocked-down carrier now drops the ball, and a Blitz block costs a square of movement. Still simplified: flat assist counting (no Guard, no marked-assister exclusion), no armour/injury rolls, and no chain pushes.'],
  ['BB Tactics — Tabletop Playbook Home Redesign', 'Shipped', 'Has its own Status section below.'],
];

const INDEX = `
## Status Index

This file mixes shipped history with forward plans. Every top-level section
carries a **Status** line — read it before treating a section as work to do.

| Section | Status |
| --- | --- |
${SECTIONS.map(([title, status]) => `| ${title} | ${status.split(',')[0]} |`).join('\n')}
| Leaderboard and Report Integrity | **Planned** |

Durable behavior that has already shipped belongs in \`docs/agent-context/\`, not
here. When a plan below ships, move the facts worth keeping into the matching
context doc and mark the section Shipped rather than deleting it — the rationale
is often still useful.

---
`;

const INTEGRITY_SECTION = `
---

# Leaderboard and Report Integrity

**Status:** Planned — partial mitigations shipped.

## Problem Statement

The client computes a run's probability and submits it. Nothing server-side
recomputes it from the rules engine, so a crafted request can claim any score.

## What already ships

\`shared/scoreValidation.js\` closes the cheap holes:

- probability must be a finite number in \`(0, 1]\` and diceCount a bounded
  integer, so NaN/Infinity/negatives can never corrupt the sort;
- \`diceCount\` must equal the number of submitted moves;
- the product of the submitted per-action probabilities must match the claimed
  total, which defeats the naive "probability: 1, diceCount: 0" tamper;
- a worse run never overwrites a better one (\`upsertPersonalBest\`);
- \`shared/rateLimit.js\` caps report submissions per session.

## What is still open

A determined attacker can still craft an internally consistent move list. Closing
that needs a server-side replay:

1. Load the scenario by id on the server.
2. Re-run the submitted moves through the rules engine (\`bfs.ts\` would need to
   become environment-neutral, or move into \`shared/\`).
3. Reject the submission if the replay's probability, dice count, or final board
   state disagrees with what was claimed.

This is deferred because it requires the rules engine to be shared between the
client and both server targets, which is a larger refactor than the leaderboard
warrants today. The per-instance report rate limiter is likewise best-effort on
Netlify — a Blobs- or KV-backed counter would make it a hard cap.

## Acceptance Criteria

- A replayed submission that does not reproduce the claimed probability is
  rejected with a 400 and never reaches the leaderboard.
- Legitimate submissions from the real client are unaffected.
`;

let spec = await readFile(specPath, 'utf8');

// Normalize each feature heading to `#` and stamp its status.
let stamped = 0;
for (const [title, status, detail] of SECTIONS) {
  const pattern = new RegExp(`^#{1,2} ${title.replace(/[.*+?^${}()|[\]\\—]/g, ch => `\\${ch}`)}$`, 'm');
  const match = spec.match(pattern);
  if (!match) {
    console.warn(`  ! heading not found, skipped: ${title}`);
    continue;
  }
  spec = spec.replace(pattern, `# ${title}\n\n**Status:** ${status}. ${detail}`);
  stamped += 1;
}

// The original Puzzle Mode spec has no single heading — it starts at "## Stack".
spec = spec.replace(
  /^## Stack$/m,
  '# Puzzle Mode\n\n**Status:** Shipped, with one deliberate divergence. Mode 2 (Puzzle Mode) is the whole game now. Mode 1 (Free Play) was removed: a puzzle is always exactly one turn, so the multi-turn loop, score, half, and turn counters no longer exist.\n\n## Stack',
);

// Drop the orphaned one-line "Problem Statement" stub between two features.
spec = spec.replace(/---\n\n---\n\n## Problem Statement\n\nA browser-based Blood Bowl puzzle game\.\n\n---\n/, '---\n');

// Insert the index after the title.
spec = spec.replace(/^(# Blood Bowl Tactical Puzzle — Spec\n)/, `$1${INDEX}`);

// Append the planned integrity section.
spec = `${spec.trimEnd()}\n${INTEGRITY_SECTION}`;

await writeFile(specPath, spec);
console.log(`Stamped ${stamped}/${SECTIONS.length} sections.`);
