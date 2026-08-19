import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_LESSONS,
  TUTORIAL_LESSON_IDS,
  FREE_PLAY_SCENARIO_ID,
  tutorialLessonFor,
} from './tutorialLessons';

describe('tutorial lessons', () => {
  it('matches the Tutorial drill order', () => {
    expect(TUTORIAL_LESSON_IDS).toEqual([
      'scenario-001',
      'scenario-004',
      'scenario-002',
      'scenario-003',
      'scenario-005',
    ]);
  });

  it('keeps the final series board as unrestricted Free Play', () => {
    expect(FREE_PLAY_SCENARIO_ID).toBe('scenario-006');
    expect(tutorialLessonFor(FREE_PLAY_SCENARIO_ID)).toBeUndefined();
    expect(tutorialLessonFor('unknown')).toBeUndefined();
  });

  it('progressively enables actions as the drills introduce them', () => {
    expect(TUTORIAL_LESSONS.map(lesson => lesson.enabledActions)).toEqual([
      ['move'],
      ['move'],
      ['move', 'handoff'],
      ['move', 'handoff', 'pass'],
      ['move', 'handoff', 'pass'],
    ]);
  });
});
