import type { GameState } from './types';
import type { TutorialDiagramHint } from './tutorialDiagram';

export type TutorialConceptId =
  | 'movement'
  | 'route-confirmation'
  | 'tackle-zones'
  | 'dodging'
  | 'handoff'
  | 'passing'
  | 'activation-order'
  | 'cumulative-probability'
  | 'blocks-blitzes'
  | 'pickup'
  | 'parallel-universes';

export type TutorialConceptStatus = 'introduced' | 'used';
export type TutorialConceptProgress = Partial<Record<TutorialConceptId, TutorialConceptStatus>>;
export type TutorialConceptMode = 'automatic' | 'manual' | 'interrupt';
export type TutorialCaptionAnchor = 'pitch' | 'action-menu' | 'confirmation' | 'probability';

export interface TutorialConcept {
  id: TutorialConceptId;
  title: string;
  explanation: string;
  suggestion: string;
  mode: TutorialConceptMode;
  anchor: TutorialCaptionAnchor;
  hint: TutorialDiagramHint;
}

const hint = (text: string, alt: string, focus: TutorialDiagramHint['focus']): TutorialDiagramHint => ({ text, alt, focus });

export const TUTORIAL_CONCEPTS: readonly TutorialConcept[] = [
  {
    id: 'movement', title: 'Movement', mode: 'automatic', anchor: 'action-menu',
    explanation: 'Move previews every reachable destination before you commit.',
    suggestion: 'Choose the player that advances the objective with the fewest rolls.',
    hint: hint('Choose a player, then choose Move to inspect reachable squares.', 'A selected player and the Move action, with the pitch still unchanged.', { kind: 'action', region: 'route', action: 'move' }),
  },
  {
    id: 'route-confirmation', title: 'Route confirmation', mode: 'automatic', anchor: 'confirmation',
    explanation: 'A plotted route is only a preview. The green control commits it; the red control lets you replot.',
    suggestion: 'Check its rolls and total chance before committing.',
    hint: hint('Review the plotted route before committing it.', 'A previewed route beside red cancel and green confirmation controls.', { kind: 'confirmation', region: 'route' }),
  },
  {
    id: 'tackle-zones', title: 'Tackle Zones', mode: 'manual', anchor: 'pitch',
    explanation: 'Standing opponents mark adjacent squares. Leaving a marked square can require an Agility Test.',
    suggestion: 'Compare paths by how many opposing Tackle Zones they leave, not only by distance.',
    hint: hint('Standing opponents influence the adjacent squares.', 'Opposing players with their adjacent Tackle Zone areas marked.', { kind: 'pitch', region: 'tackle-zones' }),
  },
  {
    id: 'dodging', title: 'Dodging', mode: 'manual', anchor: 'pitch',
    explanation: 'A route leaving a Tackle Zone shows its Dodge tests before commitment. Skills and extra markers are included in the displayed chance.',
    suggestion: 'Compare the complete route probability and keep any useful reroll available for the harder part of the route.',
    hint: hint('Dodge markers show where movement adds risk.', 'Two possible paths through opposing Tackle Zones, with risk areas marked.', { kind: 'probability', region: 'tackle-zones' }),
  },
  {
    id: 'handoff', title: 'Hand-offs', mode: 'manual', anchor: 'action-menu',
    explanation: 'A ball carrier may move before handing the ball to an adjacent teammate. The receiver makes a Catch test but keeps their activation.',
    suggestion: 'Use a Hand-off when transferring the ball creates a stronger remaining activation than carrying it alone.',
    hint: hint('Bring the carrier beside a receiver before confirming the Hand-off.', 'A ball carrier connected to an adjacent available teammate.', { kind: 'action', region: 'receiver', action: 'handoff' }),
  },
  {
    id: 'passing', title: 'Passing', mode: 'automatic', anchor: 'action-menu',
    explanation: 'A Pass combines the thrower’s PA test with the receiver’s Catch test. The thrower may move first.',
    suggestion: 'Find a safer throwing square that still leaves the receiver a route to score.',
    hint: hint('Move the thrower if needed, then inspect available receivers and the combined tests.', 'A ball carrier connected to an upfield receiver, with the Pass action highlighted.', { kind: 'action', region: 'receiver', action: 'pass' }),
  },
  {
    id: 'activation-order', title: 'Activation order', mode: 'automatic', anchor: 'pitch',
    explanation: 'Each player may activate once. An early action can create or remove later options.',
    suggestion: 'Decide what board state the next player needs to inherit.',
    hint: hint('Plan the dependency between the first activation and the player who follows.', 'Two available teammates shown as the first and second parts of one play.', { kind: 'pitch', region: 'route' }),
  },
  {
    id: 'cumulative-probability', title: 'Cumulative probability', mode: 'automatic', anchor: 'probability',
    explanation: 'Every committed roll multiplies into Success Chance. It scores the complete sequence, not only the latest action.',
    suggestion: 'Compare the whole line before adding another risk.',
    hint: hint('The Success Chance combines every committed and currently previewed roll.', 'The Success Chance readout beside alternative risky routes.', { kind: 'probability', region: 'route' }),
  },
  {
    id: 'blocks-blitzes', title: 'Blocks and Blitzes', mode: 'automatic', anchor: 'action-menu',
    explanation: 'Block is used from contact. Blitz combines movement with one Block.',
    suggestion: 'Use Blitz only when you must move to make contact.',
    hint: hint('Choose between contact now and movement into contact.', 'Block and Blitz shown beside players in and out of contact.', { kind: 'action', region: 'tackle-zones', action: 'block' }),
  },
  {
    id: 'pickup', title: 'Picking up the ball', mode: 'manual', anchor: 'pitch',
    explanation: 'Moving onto a loose ball adds a Pickup test to the route. Relevant skills and modifiers are included in its probability.',
    suggestion: 'Choose a retriever whose route and skills preserve the strongest chance after the ball is secured.',
    hint: hint('A player must move onto the loose ball to attempt a Pickup.', 'An available player with a route toward the loose ball.', { kind: 'pitch', region: 'route' }),
  },
  {
    id: 'parallel-universes', title: 'Parallel Universes', mode: 'interrupt', anchor: 'pitch',
    explanation: 'A Block can produce several useful outcomes. Instead of choosing only one, the game keeps every accepted outcome as a separate live board — a Parallel Universe. Each universe carries its share of the Block probability into your score.',
    suggestion: 'The universe strip will appear next. Each card opens one live board. Visit every unfinished card and complete the objective in that board state.',
    hint: hint('Accepted Block outcomes become separate live boards.', 'A root Block splitting into three numbered universe cards, with unfinished branches visible.', { kind: 'universes', region: 'route' }),
  },
] as const;

const CONCEPT_BY_ID = new Map(TUTORIAL_CONCEPTS.map(concept => [concept.id, concept]));

const SCENARIO_CONCEPTS: Readonly<Record<string, readonly TutorialConceptId[]>> = {
  'scenario-001': ['movement', 'route-confirmation', 'cumulative-probability'],
  'scenario-004': ['tackle-zones', 'dodging', 'route-confirmation', 'cumulative-probability'],
  'scenario-002': ['handoff', 'route-confirmation', 'activation-order', 'cumulative-probability'],
  'scenario-003': ['passing', 'route-confirmation', 'activation-order', 'cumulative-probability'],
  'scenario-005': ['activation-order', 'handoff', 'route-confirmation', 'cumulative-probability'],
  'scenario-006': ['blocks-blitzes', 'pickup', 'parallel-universes', 'cumulative-probability'],
};

export function tutorialConceptFor(id: TutorialConceptId): TutorialConcept {
  const concept = CONCEPT_BY_ID.get(id);
  if (!concept) throw new Error(`Unknown Tutorial concept: ${id}`);
  return concept;
}

export function tutorialConceptsForScenario(scenarioId: string): TutorialConcept[] {
  return (SCENARIO_CONCEPTS[scenarioId] ?? []).map(tutorialConceptFor);
}

export function tutorialConceptsUsed(state: GameState, hasSplit: boolean): Set<TutorialConceptId> {
  const used = new Set<TutorialConceptId>();
  const entries = state.actionLog;
  if (entries.some(entry => entry.kind === 'move')) {
    used.add('movement');
    used.add('route-confirmation');
  }
  if (entries.some(entry => entry.kind === 'move' && entry.dodgeTarget !== null)) {
    used.add('tackle-zones');
    used.add('dodging');
  }
  if (entries.some(entry => entry.kind === 'handoff')) used.add('handoff');
  if (entries.some(entry => entry.kind === 'pass' || entry.kind === 'pass-catch')) used.add('passing');
  if (entries.some(entry => entry.kind === 'block')) used.add('blocks-blitzes');
  if (entries.some(entry => entry.kind === 'move' && entry.pickupTarget != null)) used.add('pickup');
  if (entries.length > 1) used.add('activation-order');
  if (entries.some(entry => entry.actionProb < 1)) used.add('cumulative-probability');
  if (hasSplit) used.add('parallel-universes');
  return used;
}

export function tutorialConceptStatusLabel(status: TutorialConceptStatus | undefined): string {
  return status === 'used' ? 'Used' : status === 'introduced' ? 'Introduced' : 'Not encountered';
}
