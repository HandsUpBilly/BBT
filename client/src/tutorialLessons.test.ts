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

  it('keeps the final series board unrestricted while providing guidance', () => {
    expect(FREE_PLAY_SCENARIO_ID).toBe('scenario-006');
    expect(tutorialLessonFor(FREE_PLAY_SCENARIO_ID)?.enabledActions).toEqual([
      'move', 'handoff', 'pass', 'block', 'blitz',
    ]);
    expect(tutorialLessonFor('unknown')).toBeUndefined();
  });

  it('progressively enables actions as the drills introduce them', () => {
    expect(TUTORIAL_LESSONS.map(lesson => lesson.enabledActions)).toEqual([
      ['move'],
      ['move'],
      ['move', 'handoff'],
      ['move', 'handoff', 'pass'],
      ['move', 'handoff', 'pass'],
      ['move', 'handoff', 'pass', 'block', 'blitz'],
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
