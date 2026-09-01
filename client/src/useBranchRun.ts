/**
 * React wrapper over the pure branch run in branchRun.ts.
 *
 * Deliberately thin: every transition is a pure `BranchRun -> BranchRun`, so
 * this hook is a `useState` and a handful of callbacks. All the behaviour worth
 * testing lives in branchRun.ts and is tested without React.
 *
 * The returned shape deliberately mirrors `useGameState` — same `state`, same
 * handler names, same signatures — so `App` can pick between the two models
 * with one line instead of forking every call site. `state` is the *viewed*
 * branch's board, which is what the pitch draws.
 *
 * This is the standard game model. Before a block splits the board it behaves
 * as a single line; afterward it authors the Parallel Universes together.
 */

import { useCallback, useMemo, useState } from 'react';
import type { GameState } from './types';
import { applySquareHover, applySquareLeave } from './useGameState';
import {
  branchStrip,
  branchTreeView,
  cancelActivation,
  chooseBlockTarget,
  chooseHandoffTarget,
  choosePassTarget,
  choosePush,
  clickSquare,
  concedeBranch,
  declareBlock,
  declareHandoff,
  declarePass,
  ghostPieces,
  isBlockPending,
  isRunComplete,
  runSummary,
  resetBranchActivation,
  resetBranchToPoint,
  resetMovement,
  selectBranch,
  splitOnBlock,
  startRun,
  updateViewedState,
  viewedLine,
  type BranchRun,
} from './branchRun';

type StateUpdate = GameState | ((prev: GameState) => GameState);

export function useBranchRun(initialState: GameState) {
  const [run, setRun] = useState<BranchRun>(() => startRun(initialState));

  const viewed = viewedLine(run);

  // Recomputed whenever the run changes, which is what keeps branch weights
  // honest while the player authors: improving one branch moves the others.
  const summary = useMemo(() => runSummary(run), [run]);
  const strip = useMemo(() => branchStrip(run), [run]);
  const tree = useMemo(() => branchTreeView(run), [run]);
  const ghosts = useMemo(() => ghostPieces(run), [run]);

  /**
   * `useGameState`-shaped setter.
   *
   * A whole `GameState` means "start again from this board" — loading a
   * scenario or resetting a puzzle — so it restarts the run. An updater
   * function edits the viewed branch only, as an escape hatch; it bypasses
   * lockstep, so it is not the way to author play.
   */
  const setState = useCallback((next: StateUpdate) => {
    setRun(prev => (typeof next === 'function'
      ? updateViewedState(prev, next as (prev: GameState) => GameState)
      : startRun(next)));
  }, []);

  return {
    // ── useGameState-compatible surface ──
    state: viewed.state,
    setState,
    handleSquareClick: useCallback((col: number, row: number) => {
      setRun(prev => clickSquare(prev, { col, row }));
    }, []),
    // Hover is preview-only, so update only the viewed universe.
    handleSquareHover: useCallback((col: number, row: number) => {
      setRun(prev => updateViewedState(prev, state => applySquareHover(state, { col, row })));
    }, []),
    handleSquareLeave: useCallback(() => {
      setRun(prev => updateViewedState(prev, applySquareLeave));
    }, []),
    handleCancelSelection: useCallback(() => setRun(cancelActivation), []),
    handleResetMovement: useCallback(() => setRun(resetMovement), []),
    handleHandoffAction: useCallback((pieceId: string) => {
      setRun(prev => declareHandoff(prev, pieceId));
    }, []),
    handleHandoffTarget: useCallback((col: number, row: number) => {
      setRun(prev => chooseHandoffTarget(prev, { col, row }));
    }, []),
    handlePassAction: useCallback((pieceId: string) => {
      setRun(prev => declarePass(prev, pieceId));
    }, []),
    handlePassTarget: useCallback((col: number, row: number) => {
      setRun(prev => choosePassTarget(prev, { col, row }));
    }, []),
    handleBlockAction: useCallback((pieceId: string, isBlitz: boolean) => {
      setRun(prev => declareBlock(prev, pieceId, isBlitz));
    }, []),
    handleBlockTarget: useCallback((col: number, row: number) => {
      setRun(prev => chooseBlockTarget(prev, { col, row }));
    }, []),
    handlePushChoice: useCallback((col: number, row: number, followUp?: boolean) => {
      setRun(prev => choosePush(prev, { col, row }, followUp));
    }, []),

    // ── branch-only surface ──
    run,
    summary,
    strip,
    tree,
    ghosts,
    complete: isRunComplete(run),
    hasSplit: Object.values(run.lines).some(line => line.split !== null),
    /** A block has been targeted and is waiting for splitOnBlock — see blockPending. */
    blockPending: isBlockPending(run),
    /** Roll the declared block: splits the viewed branch's group into its board states. */
    handleResolveBlock: useCallback(() => setRun(splitOnBlock), []),
    handleSelectBranch: useCallback((id: string) => {
      setRun(prev => selectBranch(prev, id));
    }, []),
    handleConcedeBranch: useCallback((id: string) => {
      setRun(prev => concedeBranch(prev, id));
    }, []),
    handleResetBranch: useCallback((id: string) => {
      setRun(prev => resetBranchActivation(prev, id));
    }, []),
    handleResetBranchToPoint: useCallback((id: string) => {
      setRun(prev => resetBranchToPoint(prev, id));
    }, []),
  };
}
