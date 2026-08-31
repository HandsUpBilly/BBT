import { describe, expect, it } from 'vitest';
import { careerSkillGroupsFor, IMPLEMENTED_CAREER_SKILLS } from './careerSkills';

describe('career skill access', () => {
  it('uses the BB2025 Human positional primary and secondary groups', () => {
    expect(careerSkillGroupsFor('human', 'thrower')).toEqual([
      expect.objectContaining({ id: 'general', tier: 'primary' }),
      expect.objectContaining({ id: 'passing', tier: 'primary' }),
      expect.objectContaining({ id: 'agility', tier: 'secondary' }),
      expect.objectContaining({ id: 'devious', tier: 'secondary' }),
      expect.objectContaining({ id: 'strength', tier: 'secondary' }),
    ]);
  });

  it('uses the BB2025 Orc Goblin positional primary and secondary groups', () => {
    expect(careerSkillGroupsFor('orc', 'goblin')).toEqual([
      expect.objectContaining({ id: 'agility', tier: 'primary' }),
      expect.objectContaining({ id: 'devious', tier: 'primary' }),
      expect.objectContaining({ id: 'general', tier: 'secondary' }),
      expect.objectContaining({ id: 'passing', tier: 'secondary' }),
      expect.objectContaining({ id: 'strength', tier: 'secondary' }),
    ]);
  });

  it('does not invent career access for legacy editor-only roles', () => {
    expect(careerSkillGroupsFor('orc', 'blocker')).toBeNull();
  });

  it('marks only implemented rules-engine skills as selectable', () => {
    expect([...IMPLEMENTED_CAREER_SKILLS]).toEqual(['Block', 'Dodge', 'Tackle', 'Wrestle']);
  });
});
