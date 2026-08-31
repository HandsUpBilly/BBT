// Single source of truth for scenario/series shape rules.
//
// Imported by all three consumers so they can never drift:
//   - client/src/editor/editorValidation.ts  (live editor feedback)
//   - server/editor.js                        (local dev file writes)
//   - netlify/functions/editor-scenarios.js   (production Blobs drafts)
//
// Plain ESM with a sibling .d.ts so the TypeScript client can import it
// directly. Keep it dependency-free — the Netlify bundler, Node, and Vite all
// pull this file in as-is.

export const SCENARIO_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Pitch bounds in portrait coordinates (the orientation scenario JSON uses). */
export const PITCH = { maxCol: 14, maxRow: 25 };

/** Inclusive range every player stat must fall inside. */
export const STAT_RANGE = { min: 1, max: 12 };

export const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'];

export const TEAMS = ['human', 'orc'];
export const OBJECTIVES = ['touchdown'];

export function normalizeScenario(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: String(source.id ?? '').trim(),
    name: String(source.name ?? '').trim(),
    description: String(source.description ?? '').trim(),
    activeTeam: source.activeTeam === 'orc' ? 'orc' : 'human',
    objective: OBJECTIVES.includes(source.objective) ? source.objective : 'touchdown',
    // Before this field existed, scenario-006 was the sole hard-coded Free
    // Play puzzle. Preserve that published Blob data during migration.
    freePlay: source.freePlay === true || (source.freePlay == null && source.id === 'scenario-006'),
    published: source.published !== false,
    ballPosition: normalizeBallPosition(source.ballPosition),
    pieces: Array.isArray(source.pieces) ? source.pieces.map(normalizePiece) : [],
  };
}

function normalizeBallPosition(ballPosition) {
  if (!ballPosition || typeof ballPosition !== 'object') return null;
  return { col: Number(ballPosition.col), row: Number(ballPosition.row) };
}

function normalizePiece(piece) {
  const source = piece && typeof piece === 'object' ? piece : {};
  return {
    id: String(source.id ?? '').trim(),
    team: source.team === 'orc' ? 'orc' : 'human',
    role: String(source.role ?? 'lineman').trim(),
    name: String(source.name ?? '').trim(),
    ma: Number(source.ma),
    st: Number(source.st),
    ag: Number(source.ag),
    pa: Number(source.pa),
    av: Number(source.av),
    skills: Array.isArray(source.skills)
      ? source.skills.map(String).map(skill => skill.trim()).filter(Boolean)
      : [],
    position: {
      col: Number(source.position?.col),
      row: Number(source.position?.row),
    },
    hasBall: Boolean(source.hasBall),
    ...(source.down === true ? { down: true } : {}),
  };
}

export function normalizeSeries(input) {
  const source = input && typeof input === 'object' ? input : {};
  const logo = typeof source.logo === 'string' ? source.logo.trim().slice(0, 80) : '';
  const id = String(source.id ?? 'default').trim().toLowerCase();
  const teams = Array.isArray(source.teams) ? source.teams.filter(team => TEAMS.includes(team)) : [];
  return {
    id: SCENARIO_ID_RE.test(id) ? id : 'default',
    name: String(source.name ?? 'Default Series').trim() || 'Default Series',
    description: String(source.description ?? '').trim(),
    scenarioIds: Array.isArray(source.scenarioIds)
      ? source.scenarioIds.map(String).filter(Boolean)
      : [],
    teams: [teams[0] ?? 'human', teams[1] ?? (teams[0] === 'orc' ? 'human' : 'orc')],
    objective: OBJECTIVES.includes(source.objective) ? source.objective : 'touchdown',
    order: Number.isInteger(source.order) && source.order >= 0 ? source.order : 0,
    ...(logo ? { logo } : {}),
  };
}

/** Accepts both the legacy single-series object and the new ordered collection. */
export function normalizeSeriesCollection(input) {
  const collection = Array.isArray(input) ? input : input ? [input] : [];
  const seen = new Set();
  return collection
    .map(normalizeSeries)
    .filter(series => {
      if (seen.has(series.id)) return false;
      seen.add(series.id);
      return true;
    })
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

function validatePosition(position, label, errors) {
  if (!Number.isInteger(position?.col) || position.col < 0 || position.col > PITCH.maxCol) {
    errors.push(`${label} column must be between 0 and ${PITCH.maxCol}`);
  }
  if (!Number.isInteger(position?.row) || position.row < 0 || position.row > PITCH.maxRow) {
    errors.push(`${label} row must be between 0 and ${PITCH.maxRow}`);
  }
}

/**
 * Validates a *normalized* scenario. Always run normalizeScenario() first —
 * this assumes pieces[].position exists and stats are already Number()-coerced.
 *
 * @param scenario     normalized scenario
 * @param existingIds  ids already taken (Set or array)
 * @param options.allowExisting  skip the "id already exists" check (updates)
 * @param options.currentId      id being edited, exempted from the uniqueness check
 * @returns deduplicated error strings; empty means valid
 */
export function validateScenario(scenario, existingIds = new Set(), options = {}) {
  const { allowExisting = false, currentId } = options;
  const taken = existingIds instanceof Set ? existingIds : new Set(existingIds ?? []);
  const errors = [];

  if (!SCENARIO_ID_RE.test(scenario.id)) {
    errors.push('Scenario id must be lowercase letters, numbers, and hyphens');
  }
  if (!scenario.name) errors.push('Scenario name is required');
  if (!scenario.description) errors.push('Scenario description is required');
  if (!TEAMS.includes(scenario.activeTeam)) errors.push('Active team must be human or orc');
  if (!allowExisting && scenario.id !== currentId && taken.has(scenario.id)) {
    errors.push('Scenario id already exists');
  }
  if (!Array.isArray(scenario.pieces) || scenario.pieces.length === 0) {
    errors.push('At least one player is required');
  }

  const ids = new Set();
  const squares = new Set();
  let activeTeamPieces = 0;
  let carriers = 0;

  for (const piece of scenario.pieces ?? []) {
    if (!piece.id) errors.push('Every player needs an id');
    if (ids.has(piece.id)) errors.push(`Duplicate player id: ${piece.id}`);
    ids.add(piece.id);
    if (!piece.name) errors.push(`Player ${piece.id || '(missing id)'} needs a name`);
    if (!TEAMS.includes(piece.team)) errors.push(`Player ${piece.id} team must be human or orc`);
    if (piece.team === scenario.activeTeam) activeTeamPieces += 1;

    validatePosition(piece.position, `Player ${piece.id}`, errors);
    const square = `${piece.position?.col},${piece.position?.row}`;
    if (squares.has(square)) errors.push(`Multiple players on square ${square}`);
    squares.add(square);

    for (const stat of STAT_KEYS) {
      if (!Number.isInteger(piece[stat]) || piece[stat] < STAT_RANGE.min || piece[stat] > STAT_RANGE.max) {
        errors.push(`Player ${piece.id} ${stat.toUpperCase()} must be between ${STAT_RANGE.min} and ${STAT_RANGE.max}`);
      }
    }

    if (piece.hasBall) carriers += 1;
  }

  if (activeTeamPieces === 0) errors.push('At least one player must belong to the active team');
  if (scenario.ballPosition) validatePosition(scenario.ballPosition, 'Loose ball', errors);
  if (carriers > 1) errors.push('Only one player can carry the ball');
  if (carriers === 1 && scenario.ballPosition) errors.push('Ball can be carried or loose, not both');
  if (carriers === 0 && !scenario.ballPosition) errors.push('Place the ball on a player or on the ground');

  return [...new Set(errors)];
}

/** Series ids that no longer resolve to a scenario — surfaced as an editor warning. */
export function missingSeriesScenarioIds(series, scenarios) {
  const known = new Set((scenarios ?? []).map(scenario => scenario.id));
  return (series?.scenarioIds ?? []).filter(id => !known.has(id));
}
