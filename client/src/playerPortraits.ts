import type { Team } from './types';

export const DEFAULT_PLAYER_ROLE: Record<Team, string> = {
  human: 'lineman',
  orc: 'blocker',
};

/** Every role the puzzle editor allows, kept beside its portrait mapping. */
export const PLAYER_ROLES: Record<Team, readonly string[]> = {
  human: ['thrower', 'catcher', 'lineman', 'blitzer', 'halfling', 'ogre', 'blocker', 'guard', 'tackle'],
  orc: ['thrower', 'catcher', 'lineman', 'blocker', 'blitzer', 'big-un', 'goblin', 'troll', 'black-orc'],
};

const PLAYER_PORTRAITS: Record<Team, Record<string, string>> = {
  human: {
    thrower: '/human-thrower-gritty.webp',
    catcher: '/human-catcher-gritty.webp',
    lineman: '/human-lineman-gritty.webp',
    blitzer: '/human-blitzer-gritty.webp',
    halfling: '/halfling-gritty.webp',
    ogre: '/ogre-gritty.webp',
    blocker: '/human-blocker-gritty.webp',
    guard: '/human-guard-gritty.webp',
    tackle: '/human-tackle-gritty.webp',
  },
  orc: {
    thrower: '/orc-thrower-gritty.webp',
    catcher: '/orc-catcher-gritty.webp',
    lineman: '/orc-lineman-gritty.webp',
    'black-orc': '/black-orc-gritty.webp',
    blocker: '/orc-blocker-gritty.webp',
    blitzer: '/orc-blitzer-gritty.webp',
    'big-un': '/big-un-gritty.webp',
    goblin: '/goblin-gritty.webp',
    troll: '/troll-gritty.webp',
  },
};

export function playerPortraitFor(team: Team, role?: string): string {
  const portraits = PLAYER_PORTRAITS[team];
  return portraits[role ?? DEFAULT_PLAYER_ROLE[team]] ?? portraits[DEFAULT_PLAYER_ROLE[team]];
}
