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
//   - bound payload size so one request can't bloat a Blob.
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
  maxPuzzles: 50,
  /** Relative tolerance when comparing a claimed probability to the move product. */
  probabilityTolerance: 1e-6,
};

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

/**
 * Checks that a move list is internally consistent and that the product of its
 * per-action probabilities matches the claimed total.
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
    return moves;
  }

  let product = 1;
  for (const move of moves) {
    if (!move || typeof move !== 'object') throw new ScoreValidationError(`${label} contains an invalid move`);
    product *= validProbability(move.actionProb, `${label} move probability`);
  }

  if (!closeEnough(product, probability)) {
    throw new ScoreValidationError(`${label} probability does not match its recorded rolls`);
  }

  return moves;
}

export function normalizeName(name, user) {
  const resolved = String(user?.name ?? name ?? '').trim().slice(0, SCORE_LIMITS.name);
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

  return { name: normalizeName(body.name, user), probability, diceCount, moves };
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

  return { name: normalizeName(body.name, user), probability, diceCount, puzzles: validated };
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
