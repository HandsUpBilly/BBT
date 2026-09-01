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

const TEAM_ICONS: Record<Team, string> = {
  human: '/human-crest.png',
  orc: '/orc-crest.png',
  'black-orc': '/orc-black-orc.png',
  'imperial-nobility': '/imperial-noble-blitzer-gritty.webp',
};

const TEAM_ACCENT_RGB: Record<Team, string> = {
  human: '62 110 151',
  orc: '151 57 39',
  'black-orc': '74 96 43',
  'imperial-nobility': '103 79 137',
};

export function teamLabel(team: Team): string {
  return TEAM_LABELS[team];
}

export function teamPluralLabel(team: Team): string {
  return TEAM_PLURAL_LABELS[team];
}

export function teamIconSource(team: Team): string {
  return TEAM_ICONS[team];
}

/** Space-separated channels suit modern CSS rgb(var(--token) / alpha) syntax. */
export function teamAccentRgb(team: Team): string {
  return TEAM_ACCENT_RGB[team];
}

/** Human-derived teams attack the top end zone; Orc-derived teams attack the bottom. */
export function attacksTopEndZone(team: Team): boolean {
  return team === 'human' || team === 'imperial-nobility';
}

export function resolveEndZoneTeams(teams: readonly Team[]): { top: Team; bottom: Team } {
  return {
    top: teams.find(attacksTopEndZone) ?? teams[0] ?? 'human',
    bottom: teams.find(team => !attacksTopEndZone(team))
      ?? teams.find(team => team !== teams[0])
      ?? 'orc',
  };
}
