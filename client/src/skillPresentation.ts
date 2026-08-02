export type SkillGroup =
  | 'agility'
  | 'devious'
  | 'general'
  | 'mutation'
  | 'passing'
  | 'strength';

export interface SkillGroupDefinition {
  id: SkillGroup;
  label: string;
}

export interface SkillMarkerDefinition {
  skill: string;
  letter: string;
  className: string;
}

export const SKILL_GROUPS: readonly SkillGroupDefinition[] = [
  { id: 'agility', label: 'Agility' },
  { id: 'devious', label: 'Devious' },
  { id: 'general', label: 'General' },
  { id: 'mutation', label: 'Mutation' },
  { id: 'passing', label: 'Passing' },
  { id: 'strength', label: 'Strength' },
];

const SKILLS_BY_GROUP: Readonly<Record<SkillGroup, readonly string[]>> = {
  agility: [
    'Catch', 'Defensive', 'Diving Catch', 'Diving Tackle', 'Dodge',
    'Hit and Run', 'Jump Up', 'Leap', 'Safe Hands', 'Sidestep', 'Sprint',
    'Sure Feet',
  ],
  devious: [
    'Dirty Player', 'Eye Gouge', 'Fumblerooski', 'Lethal Flight',
    'Lone Fouler', 'Pile Driver', 'Put the Boot In', 'Quick Foul', 'Saboteur',
    'Shadowing', 'Sneaky Git', 'Violent Innovator',
  ],
  general: [
    'Block', 'Dauntless', 'Fend', 'Frenzy', 'Kick', 'Pro', 'Steady Footing',
    'Strip Ball', 'Sure Hands', 'Tackle', 'Taunt', 'Wrestle',
  ],
  mutation: [
    'Big Hand', 'Claws', 'Disturbing Presence', 'Extra Arms',
    'Foul Appearance', 'Horns', 'Iron Hard Skin', 'Monstrous Mouth',
    'Prehensile Tail', 'Tentacles', 'Two Heads', 'Very Long Legs',
  ],
  passing: [
    'Accurate', 'Cannoneer', 'Cloud Burster', 'Dump-Off', 'Give and Go',
    'Hail Mary Pass', 'Leader', 'Nerves of Steel', 'On the Ball', 'Pass',
    'Punt', 'Safe Pass',
  ],
  strength: [
    'Arm Bar', 'Brawler', 'Break Tackle', 'Bullseye', 'Grab', 'Guard',
    'Juggernaut', 'Mighty Blow', 'Multiple Block', 'Stand Firm', 'Strong Arm',
    'Thick Skull',
  ],
};

const skillGroupByName = new Map<string, SkillGroup>();
for (const { id } of SKILL_GROUPS) {
  for (const skill of SKILLS_BY_GROUP[id]) {
    skillGroupByName.set(skill, id);
  }
}

export const SKILL_MARKERS: readonly SkillMarkerDefinition[] = [
  { skill: 'Block', letter: 'B', className: 'block' },
  { skill: 'Dodge', letter: 'D', className: 'dodge' },
  { skill: 'Guard', letter: 'G', className: 'guard' },
  { skill: 'Tackle', letter: 'T', className: 'tackle' },
  { skill: 'Wrestle', letter: 'W', className: 'wrestle' },
  { skill: 'Mighty Blow', letter: 'M', className: 'mighty-blow' },
  { skill: 'Leader', letter: 'L', className: 'leader' },
];

export function skillGroupsFor(skills: readonly string[]): SkillGroupDefinition[] {
  const representedGroups = new Set(
    skills.map(skill => skillGroupByName.get(skill)).filter((group): group is SkillGroup => !!group),
  );

  return SKILL_GROUPS.filter(group => representedGroups.has(group.id));
}

export function skillMarkersFor(skills: readonly string[]): SkillMarkerDefinition[] {
  const representedSkills = new Set(skills);
  return SKILL_MARKERS.filter(marker => representedSkills.has(marker.skill));
}
