import { useCallback, useMemo, useState } from 'react';
import type { GameState } from './types';
import { tutorialGuideFor } from './tutorialGuides';
import {
  advanceTutorialGuide,
  reduceTutorialGuide,
  startTutorialGuide,
  type TutorialGuideEvent,
  type TutorialGuideProgress,
} from './tutorialGuideProgress';

export function useTutorialGuide() {
  const [progress, setProgress] = useState<TutorialGuideProgress | null>(null);
  const guide = useMemo(
    () => progress ? tutorialGuideFor(progress.scenarioId) : undefined,
    [progress],
  );

  const beginAttempt = useCallback((scenarioId: string) => {
    const nextGuide = tutorialGuideFor(scenarioId);
    setProgress(nextGuide ? { ...startTutorialGuide(nextGuide), visible: false } : null);
  }, []);

  const clear = useCallback(() => setProgress(null), []);

  const start = useCallback(() => {
    setProgress(current => current ? { ...current, visible: true, skipped: false } : current);
  }, []);

  const send = useCallback((event: TutorialGuideEvent) => {
    setProgress(current => {
      if (!current) return current;
      const currentGuide = tutorialGuideFor(current.scenarioId);
      return currentGuide ? reduceTutorialGuide(current, currentGuide, event) : current;
    });
  }, []);

  const observe = useCallback((state: GameState) => {
    setProgress(current => {
      if (!current) return current;
      const currentGuide = tutorialGuideFor(current.scenarioId);
      return currentGuide ? advanceTutorialGuide(current, currentGuide, state) : current;
    });
  }, []);

  const dismiss = useCallback(() => send({ kind: 'dismiss' }), [send]);
  const moreHelp = useCallback(() => send({ kind: 'more-help' }), [send]);
  const skip = useCallback(() => send({ kind: 'skip' }), [send]);
  const reopen = useCallback(() => send({ kind: 'reopen' }), [send]);

  return useMemo(() => ({
    guide,
    progress,
    beginAttempt,
    clear,
    start,
    observe,
    dismiss,
    moreHelp,
    skip,
    reopen,
    recordInteraction: send,
  }), [
    beginAttempt, clear, dismiss, guide, moreHelp, observe, progress, reopen,
    send, skip, start,
  ]);
}
