import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_LESSON_IDS,
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

  it('looks up lessons by stable scenario id', () => {
    expect(tutorialLessonFor('scenario-006')?.title).toContain('Parallel Universes');
    expect(tutorialLessonFor('unknown')).toBeUndefined();
  });
});
