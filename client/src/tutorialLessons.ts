import { OBJECTIVE_GUIDANCE } from './objectiveCopy';

export interface TutorialLesson {
  scenarioId: string;
  title: string;
  /** Actions introduced by this drill. Other menu actions remain disabled. */
  enabledActions: readonly TutorialAction[];
  paragraphs: readonly string[];
  artwork?: 'parallel-universes';
}

export type TutorialAction = 'move' | 'handoff' | 'pass' | 'block' | 'blitz';

/** The final series board is also the one unrestricted Free Play board. */
export const FREE_PLAY_SCENARIO_ID = 'scenario-006';

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    scenarioId: 'scenario-001',
    title: 'Movement',
    enabledActions: ['move'],
    paragraphs: [
      'OBJECTIVE: Carry the ball into the Human End Zone during this turn.',
      'ACTIVATION: Each player may be activated once. Select a player, choose Move, then select a destination. The route is shown before it is committed.',
      'MOVEMENT: Squares within the player\'s MA require no test. Rushes and Dodges show the required roll before the move is committed.',
      `SCORE: ${OBJECTIVE_GUIDANCE} Every committed roll multiplies that probability.`,
    ],
  },
  {
    scenarioId: 'scenario-004',
    title: 'Tackle Zones and Dodging',
    enabledActions: ['move'],
    paragraphs: [
      'TACKLE ZONES: A standing opponent marks the adjacent squares. Moving out of a marked square may require an Agility Test. Additional opposing Tackle Zones make the test harder.',
      'DODGE: The route marks every square that requires a roll. Check the chance before committing the move.',
      'DODGE SKILL: Once during her activation, Sera may reroll one failed Dodge.',
      'FAILURE: A failed route is not played. Its probability is lost from the score.',
      `SCORE: ${OBJECTIVE_GUIDANCE}`,
    ],
  },
  {
    scenarioId: 'scenario-002',
    title: 'Hand-off Action',
    enabledActions: ['move', 'handoff'],
    paragraphs: [
      'HAND-OFF: Activate the ball carrier and choose Hand-off. The carrier may move before giving the ball to an adjacent teammate.',
      'CATCH: The receiver must make the Catch roll. Receiving the ball does not use that player\'s activation.',
      'LIMIT: The team may attempt one Pass or Hand-off during the turn.',
      `SCORE: ${OBJECTIVE_GUIDANCE}`,
    ],
  },
  {
    scenarioId: 'scenario-003',
    title: 'Pass Action',
    enabledActions: ['move', 'handoff', 'pass'],
    paragraphs: [
      'PASS: Activate the ball carrier and choose Pass. The thrower may move before selecting a highlighted receiver.',
      'PASS TEST: The throw uses the player\'s PA. The receiver must then make the Catch roll. All modifiers are included in the preview.',
      'RECEIVER: Catching the ball does not use the receiver\'s activation.',
      'LIMIT: The team may attempt one Pass or Hand-off during the turn.',
      `SCORE: ${OBJECTIVE_GUIDANCE}`,
    ],
  },
  {
    scenarioId: 'scenario-005',
    title: 'The Drive',
    enabledActions: ['move', 'handoff', 'pass'],
    paragraphs: [
      'ORDER OF PLAY: Each player may be activated once. Plan the carrier\'s escape, the Hand-off, and the receiver\'s route before committing the first action.',
      'RISK: Every committed Dodge, Catch, Rush, Pickup, Pass, Hand-off, and Block roll is multiplied into the score.',
      'THE TURN: There is no End Turn action and the probability chain cannot be reset. Complete the drive with the strongest route available.',
      `SCORE: ${OBJECTIVE_GUIDANCE}`,
    ],
  },
  {
    scenarioId: 'scenario-006',
    title: 'Blocking, Pickups and Parallel Universes',
    enabledActions: ['move', 'handoff', 'pass', 'block', 'blitz'],
    artwork: 'parallel-universes',
    paragraphs: [
      'BLOCK: Cedric can hit Muzgash away from the loose ball. A Block creates separate board states for every outcome you decide can continue.',
      'PARALLEL UNIVERSES: Use the branch strip to visit each live universe. Shared safe actions are replayed in lockstep until the boards diverge.',
      'PICKUP: Move a player onto the loose ball. The required Agility Test and any Sure Hands reroll are included in the route probability.',
      'FINISH: Complete the objective in every live universe. A conceded branch contributes no scoring probability.',
      `SCORE: ${OBJECTIVE_GUIDANCE}`,
    ],
  },
] as const;

export const TUTORIAL_LESSON_IDS = TUTORIAL_LESSONS.map(lesson => lesson.scenarioId);

const LESSON_BY_SCENARIO = new Map(TUTORIAL_LESSONS.map(lesson => [lesson.scenarioId, lesson]));

export function tutorialLessonFor(scenarioId: string): TutorialLesson | undefined {
  return LESSON_BY_SCENARIO.get(scenarioId);
}
