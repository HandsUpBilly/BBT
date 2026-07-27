import type { ScenarioPieceDef, Team } from '../types';

export interface PlayerTemplate {
  key: string;
  team: Team;
  role: string;
  label: string;
  namePrefix: string;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string[];
}

export const PLAYER_TEMPLATES: PlayerTemplate[] = [
  {
    key: 'human-thrower',
    team: 'human',
    role: 'thrower',
    label: 'Human Thrower',
    namePrefix: 'Human Thrower',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 3,
    av: 8,
    skills: ['Block'],
  },
  {
    key: 'human-catcher',
    team: 'human',
    role: 'catcher',
    label: 'Human Catcher',
    namePrefix: 'Human Catcher',
    ma: 8,
    st: 2,
    ag: 4,
    pa: 5,
    av: 7,
    skills: ['Catch', 'Dodge'],
  },
  {
    key: 'human-lineman',
    team: 'human',
    role: 'lineman',
    label: 'Human Lineman',
    namePrefix: 'Human Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
  },
  {
    key: 'orc-blocker',
    team: 'orc',
    role: 'blocker',
    label: 'Orc Blocker',
    namePrefix: 'Orc Blocker',
    ma: 4,
    st: 3,
    ag: 3,
    pa: 6,
    av: 9,
    skills: ['Animosity'],
  },
  {
    key: 'orc-blitzer',
    team: 'orc',
    role: 'blitzer',
    label: 'Orc Blitzer',
    namePrefix: 'Orc Blitzer',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 5,
    av: 9,
    skills: ['Block'],
  },
  {
    key: 'orc-lineman',
    team: 'orc',
    role: 'lineman',
    label: 'Orc Lineman',
    namePrefix: 'Orc Lineman',
    ma: 5,
    st: 3,
    ag: 3,
    pa: 5,
    av: 9,
    skills: ['Animosity'],
  },
];

export function templateToPiece(template: PlayerTemplate, id: string, col: number, row: number): ScenarioPieceDef {
  return {
    id,
    team: template.team,
    role: template.role,
    name: `${template.namePrefix} ${id.split('-').pop()}`,
    ma: template.ma,
    st: template.st,
    ag: template.ag,
    pa: template.pa,
    av: template.av,
    skills: [...template.skills],
    position: { col, row },
    hasBall: false,
  };
}
