import type { Team } from './types';

export const DEFAULT_PLAYER_ROLE: Record<Team, string> = {
  human: 'lineman',
  orc: 'blocker',
};

const PLAYER_PORTRAITS: Record<Team, Record<string, string>> = {
  human: {
    thrower: '/human-thrower-gritty.webp',
    catcher: '/human-catcher-gritty.webp',
    lineman: '/human-lineman-gritty.webp',
    // There is no dedicated Human Blitzer portrait yet. Use the gritty Human
    // player fallback rather than human-tackle.png, which is a status-icon
    // sprite sheet and was never valid portrait artwork.
    blitzer: '/human-lineman-gritty.webp',
  },
  orc: {
    thrower: '/orc-thrower.png',
    catcher: '/orc-catcher.png',
    lineman: '/orc-lineman-gritty.webp',
    'black-orc': '/orc-black-orc.png',
    blocker: '/orc-blocker-gritty.webp',
    blitzer: '/orc-blitzer-gritty.webp',
    'big-un': '/orc-big-un.png',
  },
};

export function playerPortraitFor(team: Team, role?: string): string {
  const portraits = PLAYER_PORTRAITS[team];
  return portraits[role ?? DEFAULT_PLAYER_ROLE[team]] ?? portraits[DEFAULT_PLAYER_ROLE[team]];
}
