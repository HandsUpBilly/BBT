import type { Position, Scenario } from '../types';

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function validPosition(position: Position): boolean {
  return Number.isInteger(position.col) && position.col >= 0 && position.col <= 14
    && Number.isInteger(position.row) && position.row >= 0 && position.row <= 25;
}

export function validateScenarioDraft(scenario: Scenario, existingIds: string[], originalId?: string): string[] {
  const errors: string[] = [];
  if (!ID_RE.test(scenario.id)) errors.push('Use a lowercase scenario id with letters, numbers, and hyphens.');
  if (!scenario.name.trim()) errors.push('Add a puzzle name.');
  if (!scenario.description.trim()) errors.push('Add a puzzle description.');
  if (existingIds.includes(scenario.id) && scenario.id !== originalId) errors.push('That scenario id already exists.');
  if (scenario.pieces.length === 0) errors.push('Place at least one player.');

  const ids = new Set<string>();
  const squares = new Set<string>();
  let activePieces = 0;
  let carriers = 0;

  for (const piece of scenario.pieces) {
    if (!piece.id.trim()) errors.push('Every player needs an id.');
    if (ids.has(piece.id)) errors.push(`Duplicate player id: ${piece.id}`);
    ids.add(piece.id);
    if (!piece.name.trim()) errors.push(`Player ${piece.id || '(missing id)'} needs a name.`);
    if (piece.team === scenario.activeTeam) activePieces += 1;
    if (!validPosition(piece.position)) errors.push(`Player ${piece.id} is outside the pitch.`);
    const square = `${piece.position.col},${piece.position.row}`;
    if (squares.has(square)) errors.push(`Multiple players on ${square}.`);
    squares.add(square);
    if (piece.hasBall) carriers += 1;
  }

  if (activePieces === 0) errors.push('Place at least one player for the active team.');
  if (scenario.ballPosition && !validPosition(scenario.ballPosition)) errors.push('Loose ball is outside the pitch.');
  if (carriers > 1) errors.push('Only one player can carry the ball.');
  if (carriers === 1 && scenario.ballPosition) errors.push('The ball can be carried or loose, not both.');
  if (carriers === 0 && !scenario.ballPosition) errors.push('Place the ball on a player or on the ground.');

  return [...new Set(errors)];
}

export function nextScenarioId(existingIds: string[]): string {
  let index = existingIds.length + 1;
  let id = `scenario-${String(index).padStart(3, '0')}`;
  while (existingIds.includes(id)) {
    index += 1;
    id = `scenario-${String(index).padStart(3, '0')}`;
  }
  return id;
}
