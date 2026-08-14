// Server-side sanity checks on submitted leaderboard scores.
//
// The client computes the probability, so this is NOT a cheat-proof boundary.
// Be precise about what it does and does not buy:
//
// It DOES:
//   - keep NaN / Infinity / negative / >1 values out of the sort key, which
//     would otherwise corrupt every leaderboard read for everyone;
//   - reject a score whose claimed probability disagrees with the product of
//     the move list it submitted, so a tamperer cannot simply raise the number
//     on an otherwise real run;
//   - bound each request's contribution to the stored Blob: moves are capped
//     in count (SCORE_LIMITS.maxMoves) and each move is projected down to a
//     fixed whitelist of fields with length-capped strings (sanitizeMove),
//     not stored verbatim — a move object can't carry arbitrary extra
//     properties or multi-kilobyte strings into the leaderboard.
//
// It does NOT:
//   - distinguish a forged clean run from a real one. `{probability: 1,
//     diceCount: 0, moves: []}` is accepted, because walking to the end zone
//     with no rolls is a legitimate 100% solution on some scenarios.
//   - detect an internally consistent but fabricated move list.
//
// Only replaying the moves through the rules engine closes those; see spec.md
// "Leaderboard and Report Integrity" for why that is deferred.

import { blockStateWeights, blockNodeWeightedValue, DIE_FACES } from './blockWeights.js';

export const SCORE_LIMITS = {
  name: 32,
  maxMoves: 200,
  /** Nodes in a submitted branch tree — a block roughly triples the count. */
  maxTreeNodes: 200,
  /** Blocks deep a single line may go, so a hostile tree can't blow the stack. */
  maxTreeDepth: 16,
  /** Complete diagram actions include free steps, so use a separate bounded cap. */
  maxPlayLogEntries: 250,
  maxPuzzles: 50,
  /** Cap on each string field kept from a move (piece/receiver name and role). */
  moveStringLimit: 40,
  /** Relative tolerance when comparing a claimed probability to the move product. */
  probabilityTolerance: 1e-6,
};

const RANGE_BANDS = new Set(['quick', 'short', 'long', 'bomb']);
const BLOCK_FACES = new Set(['attacker-down', 'both-down', 'push', 'defender-stumbles', 'defender-down']);
const PICKERS = new Set(['attacker', 'defender']);
const DICE_COUNTS = new Set([1, 2, 3]);
const PLAY_LOG_KINDS = new Set(['move', 'handoff', 'pass', 'pass-catch', 'block']);

export class ScoreValidationError extends Error {}

function finiteNumber(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num)) throw new ScoreValidationError(`${field} must be a finite number`);
  return num;
}

function validProbability(value, field) {
  const num = finiteNumber(value, field);
  if (num <= 0 || num > 1) throw new ScoreValidationError(`${field} must be between 0 and 1`);
  return num;
}

function validDiceCount(value, field) {
  const num = finiteNumber(value, field);
  if (!Number.isInteger(num) || num < 0 || num > SCORE_LIMITS.maxMoves) {
    throw new ScoreValidationError(`${field} must be a whole number between 0 and ${SCORE_LIMITS.maxMoves}`);
  }
  return num;
}

function closeEnough(a, b) {
  return Math.abs(a - b) <= SCORE_LIMITS.probabilityTolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

function sanitizedString(value) {
  return typeof value === 'string' ? value.slice(0, SCORE_LIMITS.moveStringLimit) : '';
}

function sanitizedPosition(value) {
  const col = Number(value?.col);
  const row = Number(value?.row);
  return { col: Number.isFinite(col) ? col : 0, row: Number.isFinite(row) ? row : 0 };
}

function sanitizedPlayPosition(value) {
  const col = Number(value?.col);
  const row = Number(value?.row);
  return {
    col: Number.isInteger(col) && col >= 0 && col <= 14 ? col : 0,
    row: Number.isInteger(row) && row >= 0 && row <= 25 ? row : 0,
  };
}

/**
 * The play log is display data, not a second score claim. Keep only the small
 * field set PlayDiagram reads, while retaining free movement omitted from the
 * risky-move list. Missing logs are allowed for pre-feature clients/entries.
 */
function sanitizePlayLog(playLog) {
  if (playLog === undefined) return undefined;
  if (!Array.isArray(playLog)) throw new ScoreValidationError('playLog must be an array');
  if (playLog.length > SCORE_LIMITS.maxPlayLogEntries) {
    throw new ScoreValidationError('playLog has too many entries');
  }

  return playLog.map(entry => {
    if (!entry || typeof entry !== 'object' || !PLAY_LOG_KINDS.has(entry.kind)) {
      throw new ScoreValidationError('playLog contains an invalid entry');
    }
    const sanitized = {
      kind: entry.kind,
      pieceName: sanitizedString(entry.pieceName),
      from: sanitizedPlayPosition(entry.from),
      to: sanitizedPlayPosition(entry.to),
    };
    if (entry.receiverName !== undefined) sanitized.receiverName = sanitizedString(entry.receiverName);
    if (entry.kind === 'block') {
      sanitized.isBlitz = Boolean(entry.isBlitz);
      sanitized.diceCount = DICE_COUNTS.has(entry.diceCount) ? entry.diceCount : 1;
    }
    return sanitized;
  });
}

/** Dice roll targets are always 1-6; anything else isn't a real target. */
function sanitizedRollTarget(value) {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= 6 ? num : undefined;
}

function sanitizedCumulativeProb(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 && num <= 1 ? num : fallback;
}

/**
 * Projects a raw move object down to exactly the fields the leaderboard UI
 * renders (RiskyMove in client/src/types.ts), discarding everything else.
 * Without this, a submitted move's extra properties and string lengths were
 * stored verbatim — a single move could carry arbitrary junk into the Blob.
 */
function sanitizeMove(move, actionProb) {
  const sanitized = {
    pieceName: sanitizedString(move.pieceName),
    pieceRole: sanitizedString(move.pieceRole),
    from: sanitizedPosition(move.from),
    to: sanitizedPosition(move.to),
    dodgeTarget: sanitizedRollTarget(move.dodgeTarget) ?? null,
    isGfi: Boolean(move.isGfi),
    actionProb,
    cumulativeProb: sanitizedCumulativeProb(move.cumulativeProb, actionProb),
  };

  if (move.dodgeSkillReroll !== undefined) sanitized.dodgeSkillReroll = Boolean(move.dodgeSkillReroll);

  if (move.receiverName !== undefined) sanitized.receiverName = sanitizedString(move.receiverName);
  if (move.receiverRole !== undefined) sanitized.receiverRole = sanitizedString(move.receiverRole);

  const pickupTarget = sanitizedRollTarget(move.pickupTarget);
  if (pickupTarget !== undefined) sanitized.pickupTarget = pickupTarget;
  const catchTarget = sanitizedRollTarget(move.catchTarget);
  if (catchTarget !== undefined) sanitized.catchTarget = catchTarget;
  const passTarget = sanitizedRollTarget(move.passTarget);
  if (passTarget !== undefined) sanitized.passTarget = passTarget;
  if (RANGE_BANDS.has(move.rangeBand)) sanitized.rangeBand = move.rangeBand;

  if (move.isBlitz !== undefined) sanitized.isBlitz = Boolean(move.isBlitz);
  if (DICE_COUNTS.has(move.diceCount)) sanitized.diceCount = move.diceCount;
  if (PICKERS.has(move.picker)) sanitized.picker = move.picker;
  if (Array.isArray(move.acceptedFaces)) {
    sanitized.acceptedFaces = move.acceptedFaces.filter(face => BLOCK_FACES.has(face)).slice(0, 3);
  }
  if (BLOCK_FACES.has(move.resolvedFace)) sanitized.resolvedFace = move.resolvedFace;

  return sanitized;
}

/**
 * Checks that a move list is internally consistent and that the product of its
 * per-action probabilities matches the claimed total. Returns the sanitized
 * move list (see sanitizeMove) rather than the raw submitted objects.
 */
function validateMoves(moves, probability, diceCount, label) {
  if (!Array.isArray(moves)) throw new ScoreValidationError(`${label} moves must be an array`);
  if (moves.length > SCORE_LIMITS.maxMoves) throw new ScoreValidationError(`${label} has too many moves`);

  if (moves.length !== diceCount) {
    throw new ScoreValidationError(`${label} diceCount does not match the number of recorded rolls`);
  }

  // No rolls means nothing risky happened, so the run must be a certainty.
  if (moves.length === 0) {
    if (!closeEnough(probability, 1)) {
      throw new ScoreValidationError(`${label} probability must be 1 when no dice were rolled`);
    }
    return [];
  }

  let product = 1;
  const sanitized = [];
  for (const move of moves) {
    if (!move || typeof move !== 'object') throw new ScoreValidationError(`${label} contains an invalid move`);
    const actionProb = validProbability(move.actionProb, `${label} move probability`);
    product *= actionProb;
    sanitized.push(sanitizeMove(move, actionProb));
  }

  if (!closeEnough(product, probability)) {
    throw new ScoreValidationError(`${label} probability does not match its recorded rolls`);
  }

  return sanitized;
}

/**
 * Dice count for a branching run is a weight-weighted mean over the lines that
 * score, so it is not a whole number. Everything else about it is unchanged:
 * it is only ever a leaderboard tie-break.
 */
function validExpectedDice(value, field) {
  const num = finiteNumber(value, field);
  if (num < 0 || num > SCORE_LIMITS.maxMoves) {
    throw new ScoreValidationError(`${field} must be between 0 and ${SCORE_LIMITS.maxMoves}`);
  }
  return num;
}

function wholeCount(value, field, max) {
  const num = finiteNumber(value, field);
  if (!Number.isInteger(num) || num < 0 || num > max) {
    throw new ScoreValidationError(`${field} must be a whole number between 0 and ${max}`);
  }
  return num;
}

/**
 * The rolls committed inside one segment of a branch must multiply to the
 * segment probability it claims. This is the same product check the flat model
 * uses — under branching it just applies per segment instead of once overall,
 * because the block splits that own the rest of the probability are not rolls.
 */
function checkSegmentRolls(node, lineProb, label) {
  const moves = node.moves ?? [];
  if (!Array.isArray(moves)) throw new ScoreValidationError(`${label} moves must be an array`);
  if (moves.length > SCORE_LIMITS.maxMoves) throw new ScoreValidationError(`${label} has too many moves`);

  let product = 1;
  for (const move of moves) {
    if (!move || typeof move !== 'object') throw new ScoreValidationError(`${label} contains an invalid move`);
    product *= validProbability(move.actionProb, `${label} move probability`);
  }
  if (!closeEnough(product, lineProb)) {
    throw new ScoreValidationError(`${label} segment probability does not match its recorded rolls`);
  }
}

/**
 * Structural check on one node of a submitted branch tree, recursing into any
 * block below it. Returns nothing; the numbers are recomputed separately so the
 * shape is fully validated before any arithmetic depends on it.
 */
function checkTreeShape(node, label, depth, counter) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new ScoreValidationError(`${label} is not a valid branch`);
  }
  if (++counter.nodes > SCORE_LIMITS.maxTreeNodes) {
    throw new ScoreValidationError('Branch tree has too many nodes');
  }
  if (depth > SCORE_LIMITS.maxTreeDepth) {
    throw new ScoreValidationError('Branch tree is nested too deeply');
  }

  const lineProb = validProbability(node.lineProb, `${label} segment probability`);
  checkSegmentRolls(node, lineProb, label);

  if (node.outcome === 'scored' || node.outcome === 'conceded') {
    if (node.block !== undefined) {
      throw new ScoreValidationError(`${label} cannot both end and continue into a block`);
    }
    return;
  }
  if (node.outcome !== 'block') {
    throw new ScoreValidationError(`${label} has an unknown outcome`);
  }

  const block = node.block;
  if (!block || typeof block !== 'object') {
    throw new ScoreValidationError(`${label} is missing its block`);
  }
  if (!DICE_COUNTS.has(block.diceCount)) {
    throw new ScoreValidationError(`${label} block diceCount must be 1, 2 or 3`);
  }
  if (!PICKERS.has(block.picker)) {
    throw new ScoreValidationError(`${label} block picker must be attacker or defender`);
  }

  const faceCounts = block.faceCounts;
  if (!Array.isArray(faceCounts) || faceCounts.length === 0) {
    throw new ScoreValidationError(`${label} block must list its board states`);
  }
  if (faceCounts.length > DIE_FACES) {
    throw new ScoreValidationError(`${label} block has more board states than die faces`);
  }

  let live = 0;
  for (const faceCount of faceCounts) {
    live += wholeCount(faceCount, `${label} board state face count`, DIE_FACES);
  }
  const dead = wholeCount(block.deadFaceCount, `${label} block deadFaceCount`, DIE_FACES);

  // Every face has to land somewhere. Without this a tree could quietly drop
  // the faces that end the drive and claim the whole die scores.
  if (live + dead !== DIE_FACES) {
    throw new ScoreValidationError(`${label} block faces must add up to ${DIE_FACES}`);
  }

  if (!Array.isArray(block.children) || block.children.length !== faceCounts.length) {
    throw new ScoreValidationError(`${label} block needs one branch per board state`);
  }

  block.children.forEach((child, index) => {
    checkTreeShape(child, `${label} branch ${index + 1}`, depth + 1, counter);
  });
}

/** Conditional chance of scoring from the start of a segment. */
function treeValue(node) {
  if (node.outcome === 'scored') return node.lineProb;
  if (node.outcome === 'conceded') return 0;

  const { block } = node;
  const values = block.children.map(treeValue);
  return node.lineProb * blockNodeWeightedValue(
    block.faceCounts, block.deadFaceCount, values, block.diceCount, block.picker,
  );
}

/**
 * Recompute a submitted branch tree.
 *
 * Returns the score two independent ways — the root's value, and the summed
 * weight of the lines that actually reach a touchdown — and requires them to
 * agree. Those are genuinely different walks of the tree (values bottom-up
 * versus weights top-down), so a tree that satisfies both is internally
 * coherent in a way a single check would not establish.
 *
 * Same posture as the flat validator: this catches nonsense and keeps garbage
 * out of the sort key. It cannot tell a fabricated-but-consistent tree from a
 * real one — only replaying the moves through the rules engine would.
 */
export function validateBranchTree(tree, label) {
  checkTreeShape(tree, label, 0, { nodes: 0 });

  let scoredWeight = 0;
  let diceWeighted = 0;

  const walk = (node, incoming, diceSoFar) => {
    const survived = incoming * node.lineProb;
    if (node.outcome === 'scored') {
      scoredWeight += survived;
      diceWeighted += survived * diceSoFar;
      return;
    }
    if (node.outcome === 'conceded') return;

    const { block } = node;
    const values = block.children.map(treeValue);
    const { probabilities } = blockStateWeights(
      block.faceCounts, block.deadFaceCount, values, block.diceCount, block.picker,
    );
    const dice = diceSoFar + block.diceCount;
    block.children.forEach((child, index) => walk(child, survived * probabilities[index], dice));
  };

  walk(tree, 1, 0);

  const value = treeValue(tree);
  if (!closeEnough(value, scoredWeight)) {
    throw new ScoreValidationError(`${label} branch weights do not add up to its score`);
  }
  if (value <= 0) {
    throw new ScoreValidationError(`${label} must score somewhere to be submitted`);
  }

  return { probability: value, expectedDice: scoredWeight > 0 ? diceWeighted / scoredWeight : 0 };
}

/**
 * Sanitize a move list kept purely for display, with no product check against
 * the claimed score. Used for a branching run's primary line, whose rolls are
 * only part of what the score is made of.
 */
function sanitizeDisplayMoves(moves, label) {
  if (!Array.isArray(moves)) throw new ScoreValidationError(`${label} moves must be an array`);
  if (moves.length > SCORE_LIMITS.maxMoves) throw new ScoreValidationError(`${label} has too many moves`);

  return moves.map(move => {
    if (!move || typeof move !== 'object') throw new ScoreValidationError(`${label} contains an invalid move`);
    return sanitizeMove(move, validProbability(move.actionProb, `${label} move probability`));
  });
}

export function normalizeName(name) {
  const resolved = String(name ?? '').trim().slice(0, SCORE_LIMITS.name);
  if (!resolved) throw new ScoreValidationError('name is required');
  return resolved;
}

/** Validates a single-puzzle submission. Throws ScoreValidationError on bad input. */
export function validateScoreSubmission(body, user) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ScoreValidationError('Invalid score payload');
  }

  const probability = validProbability(body.probability, 'probability');
  const playLog = sanitizePlayLog(body.playLog);

  // A branching run's score is a sum over the branches that reach a touchdown,
  // not the product of one line's rolls, so it carries the tree it was computed
  // from and the server recomputes it. `moves` is then display data for the
  // primary line only — the product check would be meaningless against a score
  // that several branches contributed to.
  if (body.tree !== undefined) {
    const { probability: computed, expectedDice } = validateBranchTree(body.tree, 'Score');
    if (!closeEnough(computed, probability)) {
      throw new ScoreValidationError('Score probability does not match its branch tree');
    }
    const diceCount = validExpectedDice(body.diceCount, 'diceCount');
    if (!closeEnough(diceCount, expectedDice)) {
      throw new ScoreValidationError('Score diceCount does not match its branch tree');
    }
    return {
      name: normalizeName(body.name),
      probability,
      diceCount,
      moves: sanitizeDisplayMoves(body.moves ?? [], 'Score'),
      playLog,
      branching: true,
    };
  }

  const diceCount = validDiceCount(body.diceCount, 'diceCount');
  const moves = validateMoves(body.moves ?? [], probability, diceCount, 'Score');

  return { name: normalizeName(body.name), probability, diceCount, moves, playLog };
}

/** Validates a series submission: average probability, total dice, per-puzzle results. */
export function validateSeriesSubmission(body, user) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ScoreValidationError('Invalid series payload');
  }

  const probability = validProbability(body.probability, 'probability');
  const diceCount = validDiceCount(body.diceCount, 'diceCount');

  const puzzles = Array.isArray(body.puzzles) ? body.puzzles : [];
  if (puzzles.length === 0) throw new ScoreValidationError('A series score must include its puzzle results');
  if (puzzles.length > SCORE_LIMITS.maxPuzzles) throw new ScoreValidationError('Too many puzzle results');

  let probabilitySum = 0;
  let diceTotal = 0;

  const validated = puzzles.map((puzzle, index) => {
    if (!puzzle || typeof puzzle !== 'object') throw new ScoreValidationError('Invalid puzzle result');
    const label = `Puzzle ${index + 1}`;
    const puzzleProbability = validProbability(puzzle.probability, `${label} probability`);
    const puzzleDice = validDiceCount(puzzle.diceCount, `${label} diceCount`);
    const moves = validateMoves(puzzle.moves ?? [], puzzleProbability, puzzleDice, label);

    probabilitySum += puzzleProbability;
    diceTotal += puzzleDice;

    return {
      scenarioId: String(puzzle.scenarioId ?? '').slice(0, 80),
      scenarioName: String(puzzle.scenarioName ?? '').slice(0, 160),
      probability: puzzleProbability,
      diceCount: puzzleDice,
      moves,
    };
  });

  if (!closeEnough(probabilitySum / validated.length, probability)) {
    throw new ScoreValidationError('Series probability must be the average of its puzzle probabilities');
  }
  if (diceTotal !== diceCount) {
    throw new ScoreValidationError('Series diceCount must be the total across its puzzles');
  }

  return { name: normalizeName(body.name), probability, diceCount, puzzles: validated };
}

/**
 * Personal-best upsert. Returns the entry list to persist.
 *
 * A worse score never replaces a better one — submitting a sloppy run after a
 * clean one used to silently destroy the good result.
 */
export function upsertPersonalBest(entries, entry, matches) {
  const index = entries.findIndex(matches);
  if (index < 0) return [...entries, entry];

  const existing = entries[index];
  const isBetter =
    entry.probability > existing.probability ||
    (entry.probability === existing.probability && entry.diceCount < existing.diceCount);

  if (!isBetter) return entries;

  const next = [...entries];
  next[index] = entry;
  return next;
}

/** Shared ordering: highest probability first, fewest dice as the tie-break. */
export function sortEntries(entries) {
  return [...entries].sort(
    (a, b) => b.probability - a.probability || a.diceCount - b.diceCount,
  );
}
