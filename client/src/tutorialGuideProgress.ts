import type { GameState } from './types';
import { milestoneReached, type TutorialGuideDefinition, type TutorialHintTier } from './tutorialGuides';
import type { TutorialAction } from './tutorialLessons';

export interface TutorialGuideProgress {
  scenarioId: string;
  stageIndex: number;
  tier: TutorialHintTier;
  visible: boolean;
  skipped: boolean;
  complete: boolean;
  lastContradictionKey: string | null;
}

export type TutorialGuideEvent =
  | { kind: 'dismiss' }
  | { kind: 'more-help' }
  | { kind: 'skip' }
  | { kind: 'reopen' }
  | { kind: 'piece-selected'; pieceId: string; eventKey: string }
  | { kind: 'action-selected'; action: TutorialAction; pieceId: string; eventKey: string }
  | { kind: 'target-selected'; action: 'handoff' | 'pass' | 'block'; pieceId: string; eventKey: string };

export function startTutorialGuide(guide: TutorialGuideDefinition): TutorialGuideProgress {
  return {
    scenarioId: guide.scenarioId,
    stageIndex: 0,
    tier: 0,
    visible: true,
    skipped: false,
    complete: guide.stages.length === 0,
    lastContradictionKey: null,
  };
}

export function reduceTutorialGuide(
  progress: TutorialGuideProgress,
  guide: TutorialGuideDefinition,
  event: TutorialGuideEvent,
): TutorialGuideProgress {
  if (progress.complete && event.kind !== 'reopen') return progress;
  if (event.kind === 'dismiss') return { ...progress, visible: false };
  if (event.kind === 'skip') return { ...progress, visible: false, skipped: true };
  if (event.kind === 'reopen') {
    return {
      ...progress,
      stageIndex: progress.complete ? Math.max(0, guide.stages.length - 1) : progress.stageIndex,
      tier: progress.complete ? 2 : progress.tier,
      visible: true,
    };
  }
  if (event.kind === 'more-help') {
    return { ...progress, tier: Math.min(2, progress.tier + 1) as TutorialHintTier, visible: true };
  }
  if (progress.skipped) return progress;

  const stage = guide.stages[progress.stageIndex];
  const milestone = stage?.milestone;
  const completesFromInteraction = milestone && (
    (milestone.kind === 'piece-selected' && event.kind === 'piece-selected'
      && milestone.pieceId === event.pieceId)
    || (milestone.kind === 'action-started' && event.kind === 'action-selected'
      && milestone.pieceId === event.pieceId && milestone.action === event.action)
  );
  if (completesFromInteraction) {
    const stageIndex = progress.stageIndex + 1;
    return stageIndex >= guide.stages.length
      ? { ...progress, stageIndex, tier: 0, visible: false, complete: true }
      : { ...progress, stageIndex, tier: 0, visible: true, lastContradictionKey: null };
  }

  const expected = stage?.expected;
  const contradicts = expected && event.kind === expected.kind && (
    event.pieceId !== expected.pieceId
      || ((event.kind === 'action-selected' || event.kind === 'target-selected')
        && (expected.kind === 'action-selected' || expected.kind === 'target-selected')
        && event.action !== expected.action)
  );
  if (!contradicts || event.eventKey === progress.lastContradictionKey) return progress;
  return {
    ...progress,
    tier: Math.min(2, progress.tier + 1) as TutorialHintTier,
    visible: true,
    lastContradictionKey: event.eventKey,
  };
}

export function advanceTutorialGuide(
  progress: TutorialGuideProgress,
  guide: TutorialGuideDefinition,
  state: GameState,
): TutorialGuideProgress {
  if (progress.complete || progress.skipped) return progress;
  let stageIndex = progress.stageIndex;
  while (stageIndex < guide.stages.length && milestoneReached(guide.stages[stageIndex].milestone, state)) {
    stageIndex += 1;
  }
  if (stageIndex === progress.stageIndex) return progress;
  if (stageIndex >= guide.stages.length) {
    return { ...progress, stageIndex, tier: 0, visible: false, complete: true };
  }
  return { ...progress, stageIndex, tier: 0, visible: true, lastContradictionKey: null };
}
