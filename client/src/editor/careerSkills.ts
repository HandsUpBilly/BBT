import type { Team } from '../types';
import { SKILL_GROUPS, SKILLS_BY_GROUP, type SkillGroup } from '../skillPresentation';

export interface CareerSkillGroup {
  id: SkillGroup;
  label: string;
  tier: 'primary' | 'secondary';
  skills: readonly string[];
}

type CareerAccess = Readonly<Record<string, { primary: readonly SkillGroup[]; secondary: readonly SkillGroup[] }>>;

// BB2025 positional access. The letters in the roster data map
// to these six skill groups (A/D/G/M/P/S in the rulebook; we use F internally
// for Strength because it is its French roster-data code).
const CAREER_ACCESS: Readonly<Record<Team, CareerAccess>> = {
  human: {
    lineman: { primary: ['general'], secondary: ['agility', 'devious', 'strength'] },
    thrower: { primary: ['general', 'passing'], secondary: ['agility', 'devious', 'strength'] },
    catcher: { primary: ['general', 'agility'], secondary: ['devious', 'strength', 'passing'] },
    blitzer: { primary: ['general', 'strength'], secondary: ['agility', 'devious'] },
    halfling: { primary: ['agility'], secondary: ['devious', 'general', 'strength'] },
    // Big guys never gain General/Agility/Passing, on doubles or otherwise —
    // Mutation is their only secondary access. See the troll entries below.
    ogre: { primary: ['strength'], secondary: ['mutation'] },
  },
  orc: {
    lineman: { primary: ['general', 'strength'], secondary: ['agility', 'devious'] },
    thrower: { primary: ['general', 'passing'], secondary: ['agility', 'devious', 'strength'] },
    blitzer: { primary: ['general', 'strength'], secondary: ['agility', 'devious'] },
    'big-un': { primary: ['general', 'strength'], secondary: ['agility', 'devious'] },
    goblin: { primary: ['agility', 'devious'], secondary: ['general', 'passing', 'strength'] },
    troll: { primary: ['strength'], secondary: ['mutation'] },
  },
  'black-orc': {
    goblin: { primary: ['agility', 'devious'], secondary: ['general', 'passing', 'strength'] },
    'black-orc': { primary: ['general', 'strength'], secondary: ['agility', 'devious'] },
    troll: { primary: ['strength'], secondary: ['mutation'] },
  },
  'imperial-nobility': {
    retainer: { primary: ['general'], secondary: ['agility', 'strength'] },
    thrower: { primary: ['general', 'passing'], secondary: ['agility', 'strength'] },
    bodyguard: { primary: ['general', 'strength'], secondary: ['agility'] },
    'noble-blitzer': { primary: ['agility', 'general'], secondary: ['passing', 'strength'] },
    ogre: { primary: ['strength'], secondary: ['mutation'] },
  },
};

/** Skills with rules-engine effects; all other legal career skills are shown but unavailable. */
export const IMPLEMENTED_CAREER_SKILLS = new Set(['Block', 'Dodge', 'Tackle', 'Wrestle']);

export function careerSkillGroupsFor(team: Team, role?: string): CareerSkillGroup[] | null {
  const access = role ? CAREER_ACCESS[team][role] : undefined;
  if (!access) return null;

  return (['primary', 'secondary'] as const).flatMap(tier =>
    SKILL_GROUPS
      .filter(group => access[tier].includes(group.id))
      .map(group => ({ ...group, tier, skills: SKILLS_BY_GROUP[group.id] })),
  );
}
