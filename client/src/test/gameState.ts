import type { GameState, PlayerPiece, Position } from '../types';
import { makeEmptyState } from '../useGameState';

/**
 * Builds a GameState for tests.
 *
 * Deliberately delegates to makeEmptyState() so adding a field to GameState
 * doesn't require editing every test file — the previous hand-written literals
 * had to be updated in lockstep and drifted.
 */
export function makeState(
  pieces: PlayerPiece[],
  activeTeam: GameState['activeTeam'] = 'human',
  ballPosition: Position | null = null,
): GameState {
  return { ...makeEmptyState(), pieces, activeTeam, ballPosition, scenarioId: 'test-scenario' };
}

export function humanThrower(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'thrower',
    team: 'human',
    role: 'thrower',
    name: 'Aldric Swiftfoot',
    position: { col: 7, row: 10 },
    ma: 6, st: 3, ag: 3, pa: 3, av: 8,
    skills: [],
    activated: false,
    hasBall: true,
    down: false,
    ...overrides,
  };
}

export function humanCatcher(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'catcher',
    team: 'human',
    role: 'catcher',
    name: 'Sera Quickhand',
    // dx=0, dy=2 from the thrower's default position → "quick" range band
    position: { col: 7, row: 8 },
    ma: 8, st: 2, ag: 4, pa: 5, av: 7,
    skills: ['Catch', 'Dodge'],
    activated: false,
    hasBall: false,
    down: false,
    ...overrides,
  };
}

export function humanBlocker(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'human1',
    team: 'human',
    role: 'blocker',
    name: 'Aldric Swiftfoot',
    position: { col: 7, row: 10 },
    ma: 6, st: 3, ag: 3, pa: 3, av: 8,
    skills: [],
    activated: false,
    hasBall: false,
    down: false,
    ...overrides,
  };
}

export function orcBlocker(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'orc1',
    team: 'orc',
    role: 'blocker',
    name: 'Grukk Ironjaw',
    position: { col: 7, row: 9 },
    ma: 4, st: 3, ag: 3, pa: 6, av: 9,
    skills: [],
    activated: false,
    hasBall: false,
    down: false,
    ...overrides,
  };
}
