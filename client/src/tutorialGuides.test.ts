import { describe, expect, it } from 'vitest';
import { makeScenarioState } from './useGameState';
import { scenarios } from './scenarios';
import { TUTORIAL_GUIDES, milestoneReached, tutorialGuideFor } from './tutorialGuides';
import { advanceTutorialGuide, reduceTutorialGuide, startTutorialGuide } from './tutorialGuideProgress';
import { TUTORIAL_LESSONS } from './tutorialLessons';

describe('tutorial guide content', () => {
  it('has stable unique stages, three hint tiers, and valid piece references', () => {
    const stageIds = new Set<string>();
    for (const guide of TUTORIAL_GUIDES) {
      const scenario = scenarios.find(item => item.id === guide.scenarioId);
      expect(scenario).toBeDefined();
      const pieceIds = new Set(scenario!.pieces.map(piece => piece.id));
      const lesson = TUTORIAL_LESSONS.find(item => item.scenarioId === guide.scenarioId);
      expect(lesson).toBeDefined();
      for (const stage of guide.stages) {
        expect(stageIds.has(stage.id)).toBe(false);
        stageIds.add(stage.id);
        expect(stage.hints).toHaveLength(3);
        for (const tier of stage.hints) {
          expect(tier.text.length).toBeGreaterThan(20);
          expect(tier.alt.length).toBeGreaterThan(10);
          for (const pieceId of tier.focus.pieceIds ?? []) expect(pieceIds.has(pieceId)).toBe(true);
          if (tier.focus.target) {
            expect(tier.focus.target.col).toBeGreaterThanOrEqual(0);
            expect(tier.focus.target.col).toBeLessThan(15);
            expect(tier.focus.target.row).toBeGreaterThanOrEqual(0);
            expect(tier.focus.target.row).toBeLessThan(26);
          }
        }
        if (stage.expected) {
          expect(pieceIds.has(stage.expected.pieceId)).toBe(true);
          if (stage.expected.kind === 'action-selected') {
            expect(lesson!.enabledActions).toContain(stage.expected.action);
          }
        }
      }
    }
    expect(TUTORIAL_GUIDES.map(guide => guide.scenarioId).sort())
      .toEqual(TUTORIAL_LESSONS.map(lesson => lesson.scenarioId).sort());
  });

  it('starts visible, dismisses, escalates help, and skips only this attempt', () => {
    const guide = tutorialGuideFor('scenario-001')!;
    let progress = startTutorialGuide(guide);
    expect(progress.visible).toBe(true);
    progress = reduceTutorialGuide(progress, guide, { kind: 'dismiss' });
    expect(progress.visible).toBe(false);
    progress = reduceTutorialGuide(progress, guide, { kind: 'more-help' });
    expect(progress.tier).toBe(1);
    progress = reduceTutorialGuide(progress, guide, { kind: 'skip' });
    expect(progress.skipped).toBe(true);
  });

  it('escalates one tier for a contradictory selection and deduplicates the event', () => {
    const guide = tutorialGuideFor('scenario-001')!;
    let progress = startTutorialGuide(guide);
    progress = reduceTutorialGuide(progress, guide, {
      kind: 'piece-selected', pieceId: 'opp1', eventKey: 'selection-1',
    });
    expect(progress.tier).toBe(1);
    expect(progress.visible).toBe(true);
    progress = reduceTutorialGuide(progress, guide, {
      kind: 'piece-selected', pieceId: 'opp1', eventKey: 'selection-1',
    });
    expect(progress.tier).toBe(1);
  });

  it('escalates a transfer stage for the wrong receiver without completing it', () => {
    const guide = tutorialGuideFor('scenario-002')!;
    let progress = { ...startTutorialGuide(guide), stageIndex: 2, visible: false };

    progress = reduceTutorialGuide(progress, guide, {
      kind: 'target-selected', action: 'handoff', pieceId: 'orc1', eventKey: 'target-1',
    });

    expect(progress.stageIndex).toBe(2);
    expect(progress.tier).toBe(1);
    expect(progress.visible).toBe(true);
  });

  it('advances semantically when the expected state is reached', () => {
    const guide = tutorialGuideFor('scenario-001')!;
    const scenario = scenarios.find(item => item.id === guide.scenarioId)!;
    const state = { ...makeScenarioState(scenario), selectedPieceId: 'carrier' };
    expect(milestoneReached(guide.stages[0].milestone, state)).toBe(true);
    const progress = advanceTutorialGuide(startTutorialGuide(guide), guide, state);
    expect(progress.stageIndex).toBe(1);
    expect(progress.visible).toBe(true);
    expect(progress.tier).toBe(0);
  });

  it('advances selection and action stages from pre-state interaction events', () => {
    const guide = tutorialGuideFor('scenario-001')!;
    let progress = startTutorialGuide(guide);
    progress = reduceTutorialGuide(progress, guide, {
      kind: 'piece-selected', pieceId: 'carrier', eventKey: 'piece-1',
    });
    expect(progress.stageIndex).toBe(1);
    progress = reduceTutorialGuide(progress, guide, {
      kind: 'action-selected', action: 'move', pieceId: 'carrier', eventKey: 'action-2',
    });
    expect(progress.stageIndex).toBe(2);
  });

  it('does not regress completed stages when a provisional move is reset', () => {
    const guide = tutorialGuideFor('scenario-001')!;
    const scenario = scenarios.find(item => item.id === guide.scenarioId)!;
    let progress = startTutorialGuide(guide);
    progress = reduceTutorialGuide(progress, guide, {
      kind: 'piece-selected', pieceId: 'carrier', eventKey: 'piece-1',
    });
    progress = reduceTutorialGuide(progress, guide, {
      kind: 'action-selected', action: 'move', pieceId: 'carrier', eventKey: 'action-2',
    });

    progress = advanceTutorialGuide(progress, guide, makeScenarioState(scenario));

    expect(progress.stageIndex).toBe(2);
  });
});
