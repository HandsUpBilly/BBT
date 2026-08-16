export interface TutorialLesson {
  scenarioId: string;
  title: string;
  paragraphs: readonly string[];
}

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    scenarioId: 'scenario-001',
    title: 'Move and score',
    paragraphs: [
      'This puzzle is one turn: get the ball into the Human end zone. Each player can activate once.',
      'Select a player and choose Move. Preview a destination and route before you commit it. Movement up to MA needs no roll; extra rush squares and dodges show their rolls first.',
      'The success chance is the cumulative probability of every roll you commit to. That probability is your score.',
    ],
  },
  {
    scenarioId: 'scenario-004',
    title: 'Tackle zones and dodging',
    paragraphs: [
      'Moving away from a standing opponent\'s tackle zone can require an Agility roll. More opposing tackle zones make the roll harder.',
      'The route preview marks risky squares and shows how they change your running success chance.',
      'Sera\'s Dodge skill supplies one reroll for a failed dodge during her activation. Failed lines are not played out; their probability is removed from your score.',
    ],
  },
  {
    scenarioId: 'scenario-002',
    title: 'Hand off',
    paragraphs: [
      'Choose the ball carrier and Hand Off. You may move first; finish the carrier\'s movement, then select an adjacent teammate.',
      'The receiver makes the catch roll. Receiving the ball does not spend that player\'s activation, so the receiver may still move afterward.',
      'You have one shared pass-or-handoff action in the turn.',
    ],
  },
  {
    scenarioId: 'scenario-003',
    title: 'Pass',
    paragraphs: [
      'Choose Pass on the carrier. You may move to improve the throw; finish movement, then select a highlighted receiver in the pass-range overlay.',
      'The throw uses the passer\'s PA, then the receiver catches. The preview includes the relevant modifiers, and the receiver may still activate after the catch.',
      'A pass uses the same once-per-turn action as a handoff.',
    ],
  },
  {
    scenarioId: 'scenario-005',
    title: 'Combine the plan',
    paragraphs: [
      'Activation order matters: every player acts once, and the ball action is limited. Preview the carrier\'s escape, the handoff, and the receiver\'s route before committing where possible.',
      'Every committed dodge, catch, rush, pickup, pass, handoff, and block roll compounds into the run\'s success chance.',
      'There is no End Turn and no fresh probability chain. Find the strongest complete line to the end zone.',
    ],
  },
  {
    scenarioId: 'scenario-006',
    title: 'Blocks and Parallel Universes',
    paragraphs: [
      'A Block hits an adjacent standing opponent without moving. A Blitz declares a reachable target, moves into contact, costs one square for the hit, and is available once. Effective ST plus eligible assists determines the dice and who picks.',
      'Progressing a block creates a Parallel Universe for each distinct live board the dice can leave. Turnovers are already-lost probability. Use the universe strip to switch boards; legal actions replay together until a universe needs its own plan.',
      'Every universe must score or be given up. Better continuations can shift universe weights because they change which die result would be chosen. Your final score is the sum of the universes that score.',
      'The ball starts loose. Walking onto it attempts a pickup; after success that player may continue and may pass or hand off if the shared ball action remains.',
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
