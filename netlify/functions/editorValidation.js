// Ported from server/editor.js — kept in sync manually (no shared package
// between server/ and netlify/functions/ in this repo). Behavior must match
// exactly: id format, stat ranges, position bounds, ball-carrier rules.

export const SCENARIO_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export function normalizeScenario(input) {
  return {
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: String(input.description ?? '').trim(),
    activeTeam: input.activeTeam === 'orc' ? 'orc' : 'human',
    published: input.published !== false,
    ballPosition: input.ballPosition ?? null,
    pieces: Array.isArray(input.pieces) ? input.pieces.map(piece => ({
      id: String(piece.id ?? '').trim(),
      team: piece.team === 'orc' ? 'orc' : 'human',
      role: String(piece.role ?? 'lineman').trim(),
      name: String(piece.name ?? '').trim(),
      ma: Number(piece.ma),
      st: Number(piece.st),
      ag: Number(piece.ag),
      pa: Number(piece.pa),
      av: Number(piece.av),
      skills: Array.isArray(piece.skills) ? piece.skills.map(String) : [],
      position: {
        col: Number(piece.position?.col),
        row: Number(piece.position?.row),
      },
      hasBall: Boolean(piece.hasBall),
    })) : [],
  };
}

export function validatePosition(position, label, errors) {
  if (!Number.isInteger(position?.col) || position.col < 0 || position.col > 14) {
    errors.push(`${label} column must be between 0 and 14`);
  }
  if (!Number.isInteger(position?.row) || position.row < 0 || position.row > 25) {
    errors.push(`${label} row must be between 0 and 25`);
  }
}

export function validateScenario(scenario, existingIds = new Set(), { allowExisting = false } = {}) {
  const errors = [];
  if (!SCENARIO_ID_RE.test(scenario.id)) errors.push('Scenario id must be lowercase letters, numbers, and hyphens');
  if (!scenario.name) errors.push('Scenario name is required');
  if (!scenario.description) errors.push('Scenario description is required');
  if (scenario.activeTeam !== 'human' && scenario.activeTeam !== 'orc') errors.push('Active team must be human or orc');
  if (!allowExisting && existingIds.has(scenario.id)) errors.push('Scenario id already exists');
  if (!Array.isArray(scenario.pieces) || scenario.pieces.length === 0) errors.push('At least one player is required');

  const ids = new Set();
  const squares = new Set();
  let activeTeamPieces = 0;
  let carriers = 0;

  for (const piece of scenario.pieces) {
    if (!piece.id) errors.push('Every player needs an id');
    if (ids.has(piece.id)) errors.push(`Duplicate player id: ${piece.id}`);
    ids.add(piece.id);
    if (!piece.name) errors.push(`Player ${piece.id || '(missing id)'} needs a name`);
    if (piece.team !== 'human' && piece.team !== 'orc') errors.push(`Player ${piece.id} team must be human or orc`);
    if (piece.team === scenario.activeTeam) activeTeamPieces += 1;
    validatePosition(piece.position, `Player ${piece.id}`, errors);
    const square = `${piece.position.col},${piece.position.row}`;
    if (squares.has(square)) errors.push(`Multiple players on square ${square}`);
    squares.add(square);
    for (const stat of ['ma', 'st', 'ag', 'pa', 'av']) {
      if (!Number.isInteger(piece[stat]) || piece[stat] < 1 || piece[stat] > 12) {
        errors.push(`Player ${piece.id} ${stat.toUpperCase()} must be between 1 and 12`);
      }
    }
    if (piece.hasBall) carriers += 1;
  }

  if (activeTeamPieces === 0) errors.push('At least one player must belong to the active team');
  if (scenario.ballPosition) validatePosition(scenario.ballPosition, 'Loose ball', errors);
  if (carriers > 1) errors.push('Only one player can carry the ball');
  if (carriers === 1 && scenario.ballPosition) errors.push('Ball can be carried or loose, not both');
  if (carriers === 0 && !scenario.ballPosition) errors.push('Place the ball on a player or on the ground');

  return errors;
}

export function normalizeSeries(input) {
  return {
    id: 'default',
    name: String(input.name ?? 'Default Series').trim() || 'Default Series',
    description: String(input.description ?? '').trim(),
    scenarioIds: Array.isArray(input.scenarioIds)
      ? input.scenarioIds.map(String).filter(Boolean)
      : [],
  };
}
