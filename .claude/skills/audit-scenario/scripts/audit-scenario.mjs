#!/usr/bin/env node
/**
 * Enumerate every way the active team can score in a BBT puzzle, and price each
 * one with the cumulative probability the leaderboard actually scores.
 *
 * The rules maths is imported straight from `client/src/bfs.ts` (Node strips the
 * types on load), so dodge/pickup/catch/pass targets, the BB2025 range ruler,
 * block dice and push-back arcs can never drift from the game. What lives here
 * is only the *search*: which sequences of activations are worth pricing.
 *
 *   node .claude/skills/audit-scenario/scripts/audit-scenario.mjs scenario-006
 *   node ... audit-scenario.mjs path/to/draft.json --top 15 --explain 3
 *   node ... audit-scenario.mjs scenario-004 --json
 *
 * Flags:
 *   --top N       how many lines to rank (default 12)
 *   --explain N   print the roll-by-roll breakdown for the top N (default 3)
 *   --no-blitz    skip blitz openings (faster)
 *   --all-blocks  price blocks on every defender, not just the ones in the way
 *   --json        emit machine-readable JSON instead of the table
 *
 * Modelling notes are printed with the results — read them before trusting a
 * number to three decimal places.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── repo wiring ──────────────────────────────────────────────────────────────
function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'client', 'src', 'bfs.ts'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('Could not find the repo root (no client/src/bfs.ts above this script).');
}
const ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const bfs = await import(pathToFileURL(join(ROOT, 'client', 'src', 'bfs.ts')).href);
const {
  key, neighbours, dodgeTargetAt, pickupTargetAt, catchTargetAt, passTargetAt,
  rangeBandForPass, countAdjacentAssists, blockDiceCount, blockCombinedProbability,
  pushBackCandidates,
} = bfs;

// These two live in useGameState.ts rather than bfs.ts, so they are copied. If
// the turn ever grants more than two Go For It steps, change it here too.
const MAX_GFI = 2;
const ROWS = 26;
const successChance = target => (7 - target) / 6;
const endRow = team => (team === 'human' ? 0 : ROWS - 1);
const chebyshev = (a, b) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : Number(args[i + 1]);
};
const has = name => args.includes(name);
const target = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
if (!target) {
  console.error('usage: audit-scenario.mjs <scenario-id|path-to-json> [--top N] [--explain N] [--no-blitz] [--all-blocks] [--json]');
  process.exit(1);
}
const TOP = flag('--top', 12);
const EXPLAIN = flag('--explain', 3);

const path = existsSync(target)
  ? resolve(target)
  : join(ROOT, 'client', 'src', 'scenarios', target.endsWith('.json') ? target : `${target}.json`);
const scenario = JSON.parse(readFileSync(path, 'utf8'));

const startBoard = {
  pieces: scenario.pieces.map(p => ({ ...p, position: { ...p.position }, down: !!p.down })),
  ball: scenario.ballPosition ? { ...scenario.ballPosition } : null,
};
const ACTIVE = scenario.activeTeam;
const TD_ROW = endRow(ACTIVE);
const notes = [];

const standingOpponents = board => board.pieces.filter(p => p.team !== ACTIVE && !p.down).map(p => p.position);
const carrierOf = board => board.pieces.find(p => p.hasBall);
/** Where the ball is right now, however it is being held. */
const ballSquare = board => board.ball ?? carrierOf(board)?.position ?? null;

// ── movement search ──────────────────────────────────────────────────────────
/** Binary max-heap on probability — a re-sorted array made this quadratic. */
class MaxHeap {
  #items = [];
  get size() { return this.#items.length; }
  push(item) {
    const a = this.#items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].prob >= a[i].prob) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop() {
    const a = this.#items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let best = i;
        if (l < a.length && a[l].prob > a[best].prob) best = l;
        if (r < a.length && a[r].prob > a[best].prob) best = r;
        if (best === i) break;
        [a[best], a[i]] = [a[i], a[best]];
        i = best;
      }
    }
    return top;
  }
}

/**
 * Probability-maximising flood fill for one activation: every square the piece
 * can end on, and the best odds of getting there. findShortestPath optimises
 * for length; this optimises for the product of every roll, which is what the
 * score actually is.
 *
 * Returns { reached, touchdown }. `reached` is keyed by square for a piece that
 * holds the ball, and by `empty:<square>` for one that does not.
 */
function explore(board, piece, { startSteps = 0, startHas = false, blockExtra = [] } = {}) {
  const opponents = standingOpponents(board);
  const blocked = new Set(board.pieces.filter(p => p.id !== piece.id).map(p => key(p.position)));
  for (const sq of blockExtra) blocked.add(key(sq));
  const tz = new Set();
  for (const op of opponents) for (const n of neighbours(op)) tz.add(key(n));
  const maxSteps = piece.ma + MAX_GFI;
  const ball = board.ball;

  const seen = new Map();
  const reached = new Map();
  let touchdown = null;
  const stateKey = (pos, steps, hasBall) => `${key(pos)}|${steps}|${hasBall ? 1 : 0}`;

  const frontier = new MaxHeap();
  frontier.push({ pos: piece.position, steps: startSteps, has: startHas, prob: 1, rolls: [] });
  seen.set(stateKey(piece.position, startSteps, startHas), 1);

  while (frontier.size) {
    const cur = frontier.pop();
    const slot = cur.has ? key(cur.pos) : `empty:${key(cur.pos)}`;
    const best = reached.get(slot);
    if (!best || cur.prob > best.prob) reached.set(slot, cur);
    if (cur.has && cur.pos.row === TD_ROW) {
      if (!touchdown || cur.prob > touchdown.prob) touchdown = cur;
      continue; // the run ends the moment the ball crosses the line
    }
    if (cur.steps >= maxSteps) continue;

    const leavingTZ = tz.has(key(cur.pos));
    const isGfi = cur.steps >= piece.ma;
    for (const next of neighbours(cur.pos)) {
      if (blocked.has(key(next))) continue;
      let prob = cur.prob;
      const rolls = cur.rolls;
      let extra = null;
      if (isGfi) { prob *= successChance(2); extra = [...rolls, { kind: 'gfi', target: 2, at: key(next) }]; }
      if (leavingTZ) {
        const t = dodgeTargetAt(next, piece.ag, opponents);
        prob *= successChance(t);
        extra = [...(extra ?? rolls), { kind: 'dodge', target: t, at: key(next) }];
      }
      let hasBall = cur.has;
      if (!hasBall && ball && next.col === ball.col && next.row === ball.row) {
        const t = pickupTargetAt(next, piece.ag, opponents);
        prob *= successChance(t);
        extra = [...(extra ?? rolls), { kind: 'pickup', target: t, at: key(next) }];
        hasBall = true;
      }
      const sk = stateKey(next, cur.steps + 1, hasBall);
      if ((seen.get(sk) ?? 0) >= prob - 1e-12) continue;
      seen.set(sk, prob);
      frontier.push({ pos: next, steps: cur.steps + 1, has: hasBall, prob, rolls: extra ?? rolls });
    }
  }
  return { reached, touchdown };
}

const describeRolls = rolls => rolls.map(r =>
  r.kind === 'gfi' ? `GFI 2+ (${r.at})`
  : r.kind === 'dodge' ? `dodge ${r.target}+ (${r.at})`
  : `pick up ${r.target}+ (${r.at})`).join(', ');
const withRolls = (name, from, to, st) =>
  `${name} ${from}→${to}${st.rolls.length ? ` (${describeRolls(st.rolls)})` : ' (free)'}`;
const parseKey = k => {
  const raw = k.startsWith('empty:') ? k.slice(6) : k;
  const [col, row] = raw.split(',').map(Number);
  return { col, row };
};

// ── route enumeration for one board state ────────────────────────────────────
/**
 * Every shape a single turn can take once any opening block is resolved. The
 * engine allows one pass *or* handoff per turn, and catching does not mark the
 * receiver activated — which is why the "…and the receiver still has their move"
 * variants exist, and why they are so often the cheapest line on the board.
 */
function routesFor(board, prefix) {
  const lines = [];
  const mates = board.pieces.filter(p => p.team === ACTIVE && !p.down && !prefix.spent.has(p.id));
  const carried = carrierOf(board);
  const opponents = standingOpponents(board);
  const add = (kind, actors, prob, dice, steps) =>
    lines.push({ kind, actors, prob: prefix.prob * prob, dice: prefix.dice + dice, steps: [...prefix.steps, ...steps] });

  // Anyone may end up holding a loose ball; a carried one belongs to its carrier.
  const carriers = carried ? mates.filter(p => p.id === carried.id) : mates;

  // One search per team-mate, reused across every route below.
  const runs = new Map();
  for (const p of mates) runs.set(p.id, explore(board, p, { startHas: !!p.hasBall }));
  // And one "what if this player were handed the ball where they stand" run each,
  // for the routes that end with the receiver carrying it in. The deliverer's
  // final square is treated as not blocking that run — it is one square, and the
  // alternative is re-searching the board for every possible delivery point.
  const carryRuns = new Map();
  for (const p of mates) {
    const handed = { ball: null, pieces: board.pieces.map(q => (q.id === p.id ? { ...q, hasBall: true } : q)) };
    carryRuns.set(p.id, explore(handed, handed.pieces.find(q => q.id === p.id), { startHas: true }).touchdown);
  }
  // Where each team-mate could stand in the end zone, empty-handed, ready to receive.
  const endzoneSpots = new Map();
  for (const p of mates) {
    const spots = [...runs.get(p.id).reached.entries()]
      .filter(([k]) => k.startsWith('empty:') && parseKey(k).row === TD_ROW)
      .map(([k, st]) => ({ pos: parseKey(k), st }));
    spots.sort((a, b) => b.st.prob - a.st.prob);
    endzoneSpots.set(p.id, spots.slice(0, 6));
  }

  for (const carrier of carriers) {
    const { reached, touchdown } = runs.get(carrier.id);
    const withBall = [...reached.entries()].filter(([k]) => !k.startsWith('empty:'))
      .map(([k, st]) => ({ pos: parseKey(k), st }));

    // 1. carry it in yourself
    if (touchdown) {
      add('RUN', carrier.name, touchdown.prob, touchdown.rolls.length,
        [`${carrier.name} runs ${key(carrier.position)}→${key(touchdown.pos)}: ${describeRolls(touchdown.rolls) || 'no rolls'}`]);
    }

    for (const receiver of mates) {
      if (receiver.id === carrier.id) continue;

      // 2 + 3. receiver goes and stands in the end zone, then takes the ball there
      for (const { pos: ez, st: walk } of endzoneSpots.get(receiver.id)) {
        const ct = catchTargetAt(ez, receiver.ag, opponents);
        for (const { pos: from, st: spot } of withBall) {
          if (from.col === ez.col && from.row === ez.row) continue; // both can't stand there
          const dist = chebyshev(from, ez);
          const pt = passTargetAt(from, carrier.pa, ez, opponents);
          if (pt !== null && dist > 1) {
            add('PASS', `${carrier.name}→${receiver.name}`,
              spot.prob * walk.prob * successChance(pt) * successChance(ct),
              spot.rolls.length + walk.rolls.length + 2,
              [withRolls(receiver.name, key(receiver.position), key(ez), walk) + ' — waiting in the end zone',
               withRolls(carrier.name, key(carrier.position), key(from), spot),
               `${rangeBandForPass(from, ez)} pass ${pt}+ to ${key(ez)}, catch ${ct}+ — caught in the end zone`]);
          }
          if (dist === 1) {
            add('HANDOFF', `${carrier.name}→${receiver.name}`,
              spot.prob * walk.prob * successChance(ct),
              spot.rolls.length + walk.rolls.length + 1,
              [withRolls(receiver.name, key(receiver.position), key(ez), walk) + ' — waiting in the end zone',
               withRolls(carrier.name, key(carrier.position), key(from), spot),
               `hands off to ${receiver.name} on ${key(ez)}, catch ${ct}+ — received in the end zone`]);
          }
        }
      }

      // 4 + 5. give it to a team-mate who has not moved yet, who then runs it in
      const ct = catchTargetAt(receiver.position, receiver.ag, opponents);
      let bestPitch = null, bestThrow = null;
      for (const { pos: from, st: spot } of withBall) {
        const dist = chebyshev(from, receiver.position);
        const pt = dist > 1 ? passTargetAt(from, carrier.pa, receiver.position, opponents) : null;
        if (dist !== 1 && pt === null) continue;
        const handoffProb = spot.prob * successChance(ct);
        const throwProb = pt === null ? 0 : spot.prob * successChance(pt) * successChance(ct);
        // Only the best delivery square is worth running the receiver's leg for.
        if (dist === 1 && (!bestPitch || handoffProb > bestPitch.prob)) bestPitch = { from, spot, prob: handoffProb };
        if (pt !== null && (!bestThrow || throwProb > bestThrow.prob)) bestThrow = { from, spot, prob: throwProb, pt };
      }
      const run = carryRuns.get(receiver.id);
      for (const [mode, cand] of [['PITCH+RUN', bestPitch], ['THROW+RUN', bestThrow]]) {
        if (!cand || !run) continue;
        const deliver = mode === 'PITCH+RUN'
          ? `hands off to ${receiver.name} on ${key(receiver.position)}, catch ${ct}+`
          : `${rangeBandForPass(cand.from, receiver.position)} pass ${cand.pt}+ to ${receiver.name} on ${key(receiver.position)}, catch ${ct}+`;
        add(mode, `${carrier.name}→${receiver.name}`, cand.prob * run.prob,
          cand.spot.rolls.length + (mode === 'PITCH+RUN' ? 1 : 2) + run.rolls.length,
          [withRolls(carrier.name, key(carrier.position), key(cand.from), cand.spot),
           deliver,
           `${receiver.name} still has a full move: ${withRolls('', key(receiver.position), key(run.pos), run).trim()}`]);
      }
    }
  }
  return lines;
}

// ── opening moves: the blocks that reshape the board before anyone runs ──────
function blockOpenings(board) {
  const openings = [{ label: 'no block', openingKey: 'none', prob: 1, dice: 0, steps: [], spent: new Set(), board }];
  const attackers = board.pieces.filter(p => p.team === ACTIVE && !p.down);
  const ball = ballSquare(board);
  const mateSquares = attackers.map(p => p.position);

  // A defender only matters if its tackle zone touches the ball, a square next
  // to the ball, or one of your own players. Blocking anyone else cannot change
  // a single roll, and pricing them buries the real options in noise.
  const defenders = board.pieces.filter(p => p.team !== ACTIVE && !p.down).filter(d => {
    if (has('--all-blocks')) return true;
    const zone = neighbours(d.position);
    return zone.some(sq =>
      (ball && chebyshev(sq, ball) <= 1) || mateSquares.some(m => sq.col === m.col && sq.row === m.row));
  });
  const skipped = board.pieces.filter(p => p.team !== ACTIVE && !p.down).length - defenders.length;
  if (skipped > 0) notes.push(`${skipped} defender(s) marking nothing were not blocked — rerun with --all-blocks to price those too.`);

  for (const attacker of attackers) {
    for (const defender of defenders) {
      const isBlitz = chebyshev(attacker.position, defender.position) > 1;
      if (isBlitz && has('--no-blitz')) continue;

      /** The cheapest square the attacker can throw this block from. */
      let launch = null;
      if (!isBlitz) {
        launch = { pos: attacker.position, prob: 1, rolls: [], steps: 0 };
      } else {
        const { reached } = explore(board, attacker, { startHas: !!attacker.hasBall });
        for (const [k, st] of reached) {
          const pos = parseKey(k);
          if (chebyshev(pos, defender.position) !== 1) continue;
          if (st.steps + 1 > attacker.ma + MAX_GFI) continue; // the block itself costs a square
          if (!launch || st.prob > launch.prob) launch = { pos, prob: st.prob, rolls: st.rolls, steps: st.steps + 1 };
        }
      }
      if (!launch) continue;

      const teamAt = team => board.pieces.filter(p => p.team === team)
        .map(p => ({ id: p.id, position: p.id === attacker.id ? launch.pos : p.position, down: p.down }));
      const attackerAssists = countAdjacentAssists(launch.pos, teamAt(attacker.team), attacker.id);
      const defenderAssists = countAdjacentAssists(defender.position, teamAt(defender.team), defender.id);
      const { diceCount, picker } = blockDiceCount(attacker.st, attackerAssists, defender.st, defenderAssists);

      const attackerKeepsFeet = attacker.skills?.includes('Block') || attacker.skills?.includes('Wrestle');
      const defenderKeepsFeet = defender.skills?.includes('Block') && !attacker.skills?.includes('Wrestle');
      const stumblesFells = !(defender.skills?.includes('Dodge') && !attacker.skills?.includes('Tackle'));

      const knockdown = ['defender-down', ...(stumblesFells ? ['defender-stumbles'] : []),
        ...(attackerKeepsFeet && !defenderKeepsFeet ? ['both-down'] : [])];
      const clearing = [...new Set([...knockdown, 'push', ...(stumblesFells ? [] : ['defender-stumbles'])])];

      const pushes = pushBackCandidates(launch.pos, defender.position, board.pieces.map(p => p.position));
      if (pushes.length === 0) continue;
      // Shoving them as far from the ball as the arc allows is what a coach does;
      // for a knockdown the square barely matters because a downed player has no
      // tackle zone, so the same choice is fine there.
      const push = ball
        ? pushes.reduce((a, b) => (chebyshev(b, ball) > chebyshev(a, ball) ? b : a))
        : pushes[0];

      // The outcome checklist charges you for the whole accepted set but then
      // lets you continue from any face in it (BlockOutcomePanel), so checking
      // Push as well as the knockdowns and *still* resolving as a knockdown is
      // legal — and usually the line a leaderboard chaser submits. All three
      // readings are priced so the optimistic and pessimistic boards are visible.
      const variants = [[knockdown, true, 'down · tight accept']];
      if (clearing.length > knockdown.length) {
        variants.push([clearing, true, 'down · wide accept'], [clearing, false, 'push · wide accept']);
      }
      for (const [faces, downed, tag] of variants) {
        const prob = blockCombinedProbability(faces, diceCount, picker);
        if (prob <= 0) continue;
        let pieces = board.pieces.map(p => {
          if (p.id === defender.id) return { ...p, position: push, down: downed };
          if (p.id === attacker.id) return { ...p, position: launch.pos };
          return p;
        });
        let nextBall = board.ball;
        if (defender.hasBall && downed) { // a knocked-down carrier drops it where they land
          nextBall = push;
          pieces = pieces.map(p => (p.id === defender.id ? { ...p, hasBall: false } : p));
        }
        const verb = isBlitz ? 'blitzes' : 'blocks';
        openings.push({
          label: `${attacker.name} ${verb} ${defender.name} → ${tag}`,
          openingKey: `${attacker.id}>${defender.id}:${tag}`,
          prob: launch.prob * prob,
          dice: launch.rolls.length + 1,
          // The attacker has committed its activation either way; a blitzer's
          // leftover movement is priced separately as BLITZ+RUN.
          spent: new Set([attacker.id]),
          blitzed: isBlitz,
          blitzCost: isBlitz ? launch.steps : 0,
          attackerId: attacker.id,
          steps: [
            ...(launch.rolls.length ? [withRolls(attacker.name, key(attacker.position), key(launch.pos), launch)] : []),
            `${attacker.name} ${verb} ${defender.name}: ${diceCount} ${diceCount === 1 ? 'die' : 'dice'}, ` +
            `${picker} picks, accept ${faces.join('/')} — ${(prob * 100).toFixed(1)}%; ` +
            `${defender.name} ends ${downed ? 'knocked down' : 'still standing'} on ${key(push)}`,
          ],
          board: { pieces, ball: nextBall },
        });
      }
    }
  }
  return openings;
}

// ── run the audit ────────────────────────────────────────────────────────────
const allLines = [];
for (const opening of blockOpenings(startBoard)) {
  const board = opening.board;
  if (opening.blitzed) {
    // A blitzer keeps whatever movement is left, so it can still be the carrier.
    const attacker = board.pieces.find(p => p.id === opening.attackerId);
    const { touchdown } = explore(board, attacker, { startSteps: opening.blitzCost, startHas: !!attacker.hasBall });
    if (touchdown) {
      allLines.push({
        kind: 'BLITZ+RUN', actors: attacker.name,
        prob: opening.prob * touchdown.prob, dice: opening.dice + touchdown.rolls.length,
        opening: opening.label, openingKey: opening.openingKey,
        steps: [...opening.steps,
          `${attacker.name} carries on with the movement left → ${key(touchdown.pos)}` +
          `${touchdown.rolls.length ? ` (${describeRolls(touchdown.rolls)})` : ' (free)'}`],
      });
    }
  }
  for (const line of routesFor(board, opening)) {
    allLines.push({ ...line, opening: opening.label, openingKey: opening.openingKey });
  }
}

// One row per tactical decision: the same plan reached by a slightly different
// path is not a different plan.
const seenLine = new Map();
for (const line of allLines) {
  const id = `${line.openingKey}|${line.kind}|${line.actors}`;
  const prev = seenLine.get(id);
  if (!prev || line.prob > prev.prob || (line.prob === prev.prob && line.dice < prev.dice)) seenLine.set(id, line);
}
const ranked = [...seenLine.values()].sort((a, b) => b.prob - a.prob || a.dice - b.dice);

if (has('--json')) {
  console.log(JSON.stringify({ scenario: scenario.id, name: scenario.name, notes, lines: ranked.slice(0, TOP) }, null, 2));
  process.exit(0);
}

const pct = x => `${(x * 100).toFixed(1)}%`;
console.log(`\n${scenario.id} — ${scenario.name}`);
console.log(`active team: ${ACTIVE} (scores on row ${TD_ROW}) · ${scenario.pieces.length} players · ` +
  (scenario.ballPosition ? `loose ball on ${key(scenario.ballPosition)}` : `carried by ${carrierOf(startBoard)?.name ?? '(nobody!)'}`));

if (ranked.length === 0) {
  console.log('\n  NO SCORING LINE FOUND — nobody on the active team can reach the end zone this turn.');
  console.log('  That is either a broken puzzle or an intentionally impossible one; check the ball is reachable.');
  process.exit(0);
}

console.log(`\n  ${'odds'.padStart(6)}  ${'rolls'.padStart(5)}  ${'route'.padEnd(11)}  ${'who'.padEnd(34)} opening`);
console.log(`  ${'-'.repeat(104)}`);
for (const line of ranked.slice(0, TOP)) {
  console.log(`  ${pct(line.prob).padStart(6)}  ${String(line.dice).padStart(5)}  ${line.kind.padEnd(11)}  ${String(line.actors).padEnd(34)} ${line.opening}`);
}

for (const line of ranked.slice(0, EXPLAIN)) {
  console.log(`\n── ${pct(line.prob)} · ${line.kind} · ${line.dice} rolls ${'─'.repeat(30)}`);
  line.steps.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
}

const best = ranked[0];
const contenders = ranked.filter(l => l.prob >= best.prob * 0.75);
const kinds = [...new Set(contenders.map(l => l.kind))];
console.log(`\nbest line ${pct(best.prob)} (${best.kind}, ${best.dice} rolls) · ` +
  `${contenders.length} line(s) within 25% of it across ${kinds.length} mechanic(s): ${kinds.join(', ')}`);
const noBlock = ranked.find(l => l.openingKey === 'none');
if (noBlock) console.log(`best line that throws no block: ${pct(noBlock.prob)} (${noBlock.kind}, ${noBlock.actors})`);
for (const note of [...new Set(notes)]) console.log(`note: ${note}`);
console.log([
  'model: "wide accept" prices the whole checklist but resolves as the face you wanted —',
  'legal in this engine, and what a leaderboard run will do; "tight accept" is the',
  'guaranteed version. Pushes go to the square furthest from the ball. Chain pushes,',
  'follow-up moves, armour and injury are not simulated, and a receiver walking into the',
  'end zone is not treated as blocking the carrier across that one square.',
].join('\n       '));
