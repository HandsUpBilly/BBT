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

export const SCORE_LIMITS = {
  name: 32,
  maxMoves: 200,
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
  const diceCount = validDiceCount(body.diceCount, 'diceCount');
  const moves = validateMoves(body.moves ?? [], probability, diceCount, 'Score');
  const playLog = sanitizePlayLog(body.playLog);

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
