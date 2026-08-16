export interface TutorialLesson {
  scenarioId: string;
  title: string;
  paragraphs: readonly string[];
}

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    scenarioId: 'scenario-001',
    title: 'Movement',
    paragraphs: [
      'OBJECTIVE: Carry the ball into the Human End Zone during this turn.',
      'ACTIVATION: Each player may be activated once. Select a player, choose Move, then select a destination. The route is shown before it is committed.',
      'MOVEMENT: Squares within the player\'s MA require no test. Rushes and Dodges show the required roll before the move is committed.',
      'SCORE: Multiply the chance of every committed roll. The result is the score for the play.',
    ],
  },
  {
    scenarioId: 'scenario-004',
    title: 'Tackle Zones and Dodging',
    paragraphs: [
      'TACKLE ZONES: A standing opponent marks the adjacent squares. Moving out of a marked square may require an Agility Test. Additional opposing Tackle Zones make the test harder.',
      'DODGE: The route marks every square that requires a roll. Check the chance before committing the move.',
      'DODGE SKILL: Once during her activation, Sera may reroll one failed Dodge.',
      'FAILURE: A failed route is not played. Its probability is lost from the score.',
    ],
  },
  {
    scenarioId: 'scenario-002',
    title: 'Hand-off Action',
    paragraphs: [
      'HAND-OFF: Activate the ball carrier and choose Hand-off. The carrier may move before giving the ball to an adjacent teammate.',
      'CATCH: The receiver must make the Catch roll. Receiving the ball does not use that player\'s activation.',
      'LIMIT: The team may attempt one Pass or Hand-off during the turn.',
    ],
  },
  {
    scenarioId: 'scenario-003',
    title: 'Pass Action',
    paragraphs: [
      'PASS: Activate the ball carrier and choose Pass. The thrower may move before selecting a highlighted receiver.',
      'PASS TEST: The throw uses the player\'s PA. The receiver must then make the Catch roll. All modifiers are included in the preview.',
      'RECEIVER: Catching the ball does not use the receiver\'s activation.',
      'LIMIT: The team may attempt one Pass or Hand-off during the turn.',
    ],
  },
  {
    scenarioId: 'scenario-005',
    title: 'The Drive',
    paragraphs: [
      'ORDER OF PLAY: Each player may be activated once. Plan the carrier\'s escape, the Hand-off, and the receiver\'s route before committing the first action.',
      'RISK: Every committed Dodge, Catch, Rush, Pickup, Pass, Hand-off, and Block roll is multiplied into the score.',
      'THE TURN: There is no End Turn action and the probability chain cannot be reset. Complete the drive with the strongest route available.',
    ],
  },
  {
    scenarioId: 'scenario-006',
    title: 'Blocking and Parallel Universes',
    paragraphs: [
      'BLOCK ACTION: A standing player may Block an adjacent standing opponent. The attacker does not move before the Block.',
      'BLITZ ACTION: Declare a target, move into contact, then Block. The hit costs one square of MA. The team may make one Blitz during the turn.',
      'BLOCK DICE: Compare each player\'s ST after adding eligible assists. This decides how many dice are rolled and which coach chooses the result.',
      'PARALLEL UNIVERSES: Each live board left by the Block becomes a universe. A Turnover result is lost probability and cannot be played.',
      'UNIVERSE PLAY: Select a universe from the strip. Legal actions are applied to every matching universe. When the boards differ, resolve each universe separately.',
      'COMPLETION: Every live universe must score or be given up. The final score is the total probability of the universes that score.',
      'LOOSE BALL: Entering the ball\'s square attempts a Pickup. After a successful Pickup, the player may continue moving and may Pass or Hand-off if that action remains available.',
    ],
  },
] as const;

export const TUTORIAL_LESSON_IDS = TUTORIAL_LESSONS.map(lesson => lesson.scenarioId);

const LESSON_BY_SCENARIO = new Map(TUTORIAL_LESSONS.map(lesson => [lesson.scenarioId, lesson]));
const LESSON_ID_SET = new Set(TUTORIAL_LESSON_IDS);

export function tutorialLessonFor(scenarioId: string): TutorialLesson | undefined {
  return LESSON_BY_SCENARIO.get(scenarioId);
}

export function sanitizeTutorialLessonIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && LESSON_ID_SET.has(id)))];
}
