import { describe, expect, it } from 'vitest';
import { SKILL_GROUPS, skillGroupsFor, skillMarkersFor } from './skillPresentation';

describe('skillGroupsFor', () => {
  it('classifies representative skills from every group in canonical order', () => {
    expect(skillGroupsFor([
      'Guard', 'Leader', 'Big Hand', 'Block', 'Catch', 'Dirty Player',
    ])).toEqual(SKILL_GROUPS);
  });

  it('deduplicates multiple skills from the same group', () => {
    expect(skillGroupsFor(['Catch', 'Dodge'])).toEqual([
      { id: 'agility', label: 'Agility' },
    ]);
  });

  it('keeps canonical order regardless of source skill order', () => {
    expect(skillGroupsFor(['Mighty Blow', 'Block', 'Dodge'])).toEqual([
      { id: 'agility', label: 'Agility' },
      { id: 'general', label: 'General' },
      { id: 'strength', label: 'Strength' },
    ]);
  });

  it('ignores traits and unknown skills without failing', () => {
    expect(skillGroupsFor([])).toEqual([]);
    expect(skillGroupsFor(['Animosity', 'Unknown Skill'])).toEqual([]);
    expect(skillGroupsFor(['Animosity', 'Block'])).toEqual([
      { id: 'general', label: 'General' },
    ]);
  });
});

describe('skillMarkersFor', () => {
  it('returns the canonical seven markers in stable order', () => {
    const shuffledSkills = [
      'Leader', 'Mighty Blow', 'Wrestle', 'Tackle', 'Guard', 'Dodge', 'Block',
    ];
    expect(skillMarkersFor(shuffledSkills)).toEqual([
      { skill: 'Block', letter: 'B', className: 'block' },
      { skill: 'Dodge', letter: 'D', className: 'dodge' },
      { skill: 'Guard', letter: 'G', className: 'guard' },
      { skill: 'Tackle', letter: 'T', className: 'tackle' },
      { skill: 'Wrestle', letter: 'W', className: 'wrestle' },
      { skill: 'Mighty Blow', letter: 'M', className: 'mighty-blow' },
      { skill: 'Leader', letter: 'L', className: 'leader' },
    ]);
  });

  it('does not mark categorized skills outside the canonical seven', () => {
    expect(skillMarkersFor(['Catch', 'Animosity', 'Sure Hands'])).toEqual([]);
  });

  it('deduplicates repeated marker skills', () => {
    expect(skillMarkersFor(['Guard', 'Guard', 'Block'])).toEqual([
      { skill: 'Block', letter: 'B', className: 'block' },
      { skill: 'Guard', letter: 'G', className: 'guard' },
    ]);
  });
});
