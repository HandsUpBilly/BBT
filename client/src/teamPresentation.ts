import type { Team } from './types';

export const TEAMS: readonly Team[] = ['human', 'orc', 'black-orc', 'imperial-nobility'];

const TEAM_LABELS: Record<Team, string> = {
  human: 'Human',
  orc: 'Orc',
  'black-orc': 'Black Orc',
  'imperial-nobility': 'Imperial Nobility',
};

const TEAM_PLURAL_LABELS: Record<Team, string> = {
  human: 'Humans',
  orc: 'Orcs',
  'black-orc': 'Black Orcs',
  'imperial-nobility': 'Imperial Nobility',
};

export function teamLabel(team: Team): string {
  return TEAM_LABELS[team];
}

export function teamPluralLabel(team: Team): string {
  return TEAM_PLURAL_LABELS[team];
}

/** Human-derived teams attack the top end zone; Orc-derived teams attack the bottom. */
export function attacksTopEndZone(team: Team): boolean {
  return team === 'human' || team === 'imperial-nobility';
}
