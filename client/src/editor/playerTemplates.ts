import type { ScenarioPieceDef, Team } from '../types';

/**
 * Roster stats are stored the way the engine consumes them, which is not the
 * way BB2025 prints them:
 *
 *   ma  as printed
 *   st  as printed
 *   ag  6 minus the printed target, because `bfs.ts` rolls `6 - ag`
 *       (AG 3+ → 3, AG 4+ → 2, AG 5+ → 1)
 *   pa  the printed target, used directly by `passTargetAt` (PA 3+ → 3)
 *   av  the printed target minus 1, matching the pieces already in the
 *       scenarios (AV 9+ → 8). Display-only — armour is never rolled.
 *
 * Roster source: https://bbtactics.com/human-teams/ and
 * https://bbtactics.com/orc-teams/ (BB2025).
 */
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
  /** Overrides the team-wide name pool for non-Human/non-Orc positionals. */
  names?: string[];
}

const HUMAN_NAMES = [
  'Aldric Swiftfoot',
  'Bramm Surehands',
  'Cedric Linebreaker',
  'Dieter Longstride',
  'Edwin Brighthelm',
  'Franz Quickstep',
  'Garran Ballwise',
  'Hugo Ironlace',
  'Jorek Fleetmark',
  'Kasper Dawnboot',
];

const ORC_NAMES = [
  'Grukk Ironjaw',
  'Muzgash Skullkrak',
  'Vrak Bonecruncher',
  'Dorg Gutripper',
  'Skrag Headsmash',
  'Zug Bloodfang',
  'Rukbad Bootsnappa',
  'Gorzag Teefgrinda',
  'Nobgul Linebasher',
  'Throg Chainbellow',
];

// Per-position pools: the big guys and the little guys read wrong with a
// straight Human/Orc name.
const HALFLING_NAMES = [
  'Pippin Pieclutch',
  'Bodo Barrelroll',
  'Milo Muddyboot',
  'Toby Tumblefoot',
];

const OGRE_NAMES = [
  'Bulg the Immense',
  'Grod Ribcracker',
  'Mungo Two-Ton',
];

const GOBLIN_NAMES = [
  'Snik Ratfinger',
  'Zag Nosebiter',
  'Krib Toepoker',
  'Nizz Grubsnatcher',
];

const TROLL_NAMES = [
  'Brakk Stonegut',
  'Ugthar Slabjaw',
  'Wurm Boulderfist',
];

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
    skills: ['Pass', 'Sure Hands'],
  },
  {
    key: 'human-catcher',
    team: 'human',
    role: 'catcher',
    label: 'Human Catcher',
    namePrefix: 'Human Catcher',
    ma: 8,
    st: 3,
    ag: 3,
    pa: 4,
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
    key: 'human-blitzer',
    team: 'human',
    role: 'blitzer',
    label: 'Human Blitzer',
    namePrefix: 'Human Blitzer',
    ma: 7,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: ['Block', 'Tackle'],
  },
  {
    key: 'halfling-hopeful',
    team: 'human',
    role: 'halfling',
    label: 'Halfling Hopeful',
    namePrefix: 'Halfling Hopeful',
    ma: 5,
    st: 2,
    ag: 3,
    pa: 4,
    av: 6,
    skills: ['Dodge', 'Right Stuff', 'Stunty'],
    names: HALFLING_NAMES,
  },
  {
    key: 'human-ogre',
    team: 'human',
    role: 'ogre',
    label: 'Ogre',
    namePrefix: 'Ogre',
    ma: 5,
    st: 5,
    ag: 2,
    pa: 5,
    av: 9,
    skills: ['Bone Head', 'Loner (3+)', 'Mighty Blow', 'Thick Skull', 'Throw Team Mate'],
    names: OGRE_NAMES,
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
    pa: 4,
    av: 9,
    skills: ['Block', 'Break Tackle'],
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
    pa: 4,
    av: 9,
    skills: [],
  },
  {
    key: 'orc-thrower',
    team: 'orc',
    role: 'thrower',
    label: 'Orc Thrower',
    namePrefix: 'Orc Thrower',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 3,
    av: 8,
    skills: ['Pass', 'Sure Hands'],
  },
  {
    key: 'orc-big-un',
    team: 'orc',
    role: 'big-un',
    label: 'Big Un Blocker',
    namePrefix: 'Big Un Blocker',
    ma: 5,
    st: 4,
    ag: 2,
    pa: 6,
    av: 9,
    skills: ['Mighty Blow', 'Taunt', 'Thick Skull', 'Unsteady'],
  },
  {
    key: 'goblin-lineman',
    team: 'orc',
    role: 'goblin',
    label: 'Goblin Lineman',
    namePrefix: 'Goblin Lineman',
    ma: 6,
    st: 2,
    ag: 3,
    pa: 3,
    av: 7,
    skills: ['Dodge', 'Right Stuff', 'Stunty'],
    names: GOBLIN_NAMES,
  },
  {
    key: 'orc-troll',
    team: 'orc',
    role: 'troll',
    label: 'Troll',
    namePrefix: 'Troll',
    ma: 4,
    st: 5,
    ag: 1,
    pa: 5,
    av: 9,
    skills: [
      'Always Hungry',
      'Loner (4+)',
      'Mighty Blow',
      'Projectile Vomit',
      'Really Stupid',
      'Regeneration',
      'Throw Team Mate',
    ],
    names: TROLL_NAMES,
  },
];

export function generatedPlayerName(template: PlayerTemplate, index: number): string {
  const names = template.names ?? (template.team === 'human' ? HUMAN_NAMES : ORC_NAMES);
  const base = names[index % names.length];
  const cycle = Math.floor(index / names.length);
  return cycle === 0 ? base : `${base} ${cycle + 1}`;
}

export function templateToPiece(
  template: PlayerTemplate,
  id: string,
  col: number,
  row: number,
  name: string,
): ScenarioPieceDef {
  return {
    id,
    team: template.team,
    role: template.role,
    name,
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
