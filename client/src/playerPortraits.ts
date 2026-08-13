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
    blitzer: '/human-blitzer-gritty.webp',
    ogre: '/ogre-gritty.webp',
  },
  orc: {
    thrower: '/orc-thrower.png',
    catcher: '/orc-catcher.png',
    lineman: '/orc-lineman-gritty.webp',
    'black-orc': '/black-orc-gritty.webp',
    blocker: '/orc-blocker-gritty.webp',
    blitzer: '/orc-blitzer-gritty.webp',
    'big-un': '/big-un-gritty.webp',
    troll: '/troll-gritty.webp',
  },
};

export function playerPortraitFor(team: Team, role?: string): string {
  const portraits = PLAYER_PORTRAITS[team];
  return portraits[role ?? DEFAULT_PLAYER_ROLE[team]] ?? portraits[DEFAULT_PLAYER_ROLE[team]];
}
