/**
 * React wrapper over the pure branch run in branchRun.ts.
 *
 * Deliberately thin: every transition is a pure `BranchRun -> BranchRun`, so
 * this hook is a `useState` and a handful of callbacks. All the behaviour worth
 * testing lives in branchRun.ts and is tested without React.
 *
 * Only used when the `blockBranching` preference is on; the checklist path
 * still goes through `useGameState` unchanged.
 */

import { useCallback, useMemo, useState } from 'react';
import type { GameState } from './types';
import {
  branchStrip,
  cancelActivation as cancelActivationIn,
  choosePush as choosePushIn,
  clickSquare as clickSquareIn,
  concedeBranch as concedeBranchIn,
  isRunComplete,
  runSummary,
  selectBranch as selectBranchIn,
  splitOnBlock as splitOnBlockIn,
  startRun,
  viewedLine,
  type BranchRun,
} from './branchRun';

export function useBranchRun(initialState: GameState) {
  const [run, setRun] = useState<BranchRun>(() => startRun(initialState));

  // Recomputed whenever the run changes, which is what keeps branch weights
  // honest while the player authors: improving one branch moves the others.
  const summary = useMemo(() => runSummary(run), [run]);
  const strip = useMemo(() => branchStrip(run), [run]);

  return {
    run,
    setRun,
    /** The branch the player is looking at — its board drives the pitch. */
    viewed: viewedLine(run),
    summary,
    strip,
    complete: isRunComplete(run),
    handleSquareClick: useCallback((col: number, row: number) => {
      setRun(prev => clickSquareIn(prev, { col, row }));
    }, []),
    handlePushChoice: useCallback((col: number, row: number, followUp: boolean) => {
      setRun(prev => choosePushIn(prev, { col, row }, followUp));
    }, []),
    handleCancelSelection: useCallback(() => setRun(cancelActivationIn), []),
    handleResolveBlock: useCallback(() => setRun(splitOnBlockIn), []),
    handleConcedeBranch: useCallback((id: string) => {
      setRun(prev => concedeBranchIn(prev, id));
    }, []),
    handleSelectBranch: useCallback((id: string) => {
      setRun(prev => selectBranchIn(prev, id));
    }, []),
  };
}
