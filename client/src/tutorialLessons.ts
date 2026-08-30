import { OBJECTIVE_GUIDANCE } from './objectiveCopy';

export interface TutorialLesson {
  scenarioId: string;
  title: string;
  /** Actions emphasized by this drill. Every action that is legal remains available. */
  emphasizedActions: readonly TutorialAction[];
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
    emphasizedActions: ['move'],
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
    emphasizedActions: ['move'],
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
    emphasizedActions: ['handoff'],
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
    emphasizedActions: ['pass'],
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
    emphasizedActions: ['move', 'handoff', 'pass'],
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
    emphasizedActions: ['block', 'blitz'],
    artwork: 'parallel-universes',
    paragraphs: [
      'DICE SO FAR: Every roll until now has been pass or fail — a Dodge lands or it doesn\'t, a Catch is made or dropped. A Block breaks that rule: several of its results can all still be worth playing on.',
      'BLOCK: Cedric can hit Muzgash away from the loose ball. Every outcome worth playing on opens its own board state — a parallel universe — instead of forcing you to pick just one.',
      'PARALLEL UNIVERSES: Nothing is thrown away. Every live universe is played to its own finish, and the final score adds up the scoring probability across all of them.',
      'LOCKSTEP: A move that needs no new dice roll is replayed automatically into every universe that can still take it. Push Back and Push Back + Down usually want the same next move, so lockstep plays it once for both. A universe where the Block leaves both players down beside a second Human needs a different plan — it drops out of lockstep and waits for you.',
      'BRANCH STRIP: Switch between universes on the strip that runs across the top of the screen, above the pitch. Each card shows that universe\'s dice, its share of the score, and whether it still needs attention.',
      'MORE BLOCKS, MORE UNIVERSES: Every further Block multiplies whatever is still live. Two or three blocks in a row and you can be resolving a dozen universes at once.',
      'PICKUP: Move a player onto the loose ball. The required Agility Test and any Sure Hands reroll are included in the route probability.',
      'FINISH: Complete the objective in every live universe. A conceded universe contributes no scoring probability.',
      `SCORE: ${OBJECTIVE_GUIDANCE}`,
    ],
  },
] as const;

export const TUTORIAL_LESSON_IDS = TUTORIAL_LESSONS.map(lesson => lesson.scenarioId);

const LESSON_BY_SCENARIO = new Map(TUTORIAL_LESSONS.map(lesson => [lesson.scenarioId, lesson]));

export function tutorialLessonFor(scenarioId: string): TutorialLesson | undefined {
  return LESSON_BY_SCENARIO.get(scenarioId);
}
