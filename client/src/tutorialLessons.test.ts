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
      'scenario-006',
    ]);
  });

  it('emphasizes the final drill concepts without defining action availability', () => {
    expect(FREE_PLAY_SCENARIO_ID).toBe('scenario-006');
    expect(tutorialLessonFor(FREE_PLAY_SCENARIO_ID)?.emphasizedActions).toEqual(['block', 'blitz']);
    expect(tutorialLessonFor('unknown')).toBeUndefined();
  });

  it('emphasizes each drill subject without hiding other legal actions', () => {
    expect(TUTORIAL_LESSONS.map(lesson => lesson.emphasizedActions)).toEqual([
      ['move'],
      ['move'],
      ['handoff'],
      ['pass'],
      ['move', 'handoff', 'pass'],
      ['block', 'blitz'],
    ]);
  });

  it('frames every drill as finding the most probable sequence for its objective', () => {
    for (const lesson of TUTORIAL_LESSONS) {
      expect(lesson.paragraphs.join(' ')).toContain(
        "Find the sequence of moves with the highest probability of meeting the puzzle's stated objective.",
      );
    }
  });
});
