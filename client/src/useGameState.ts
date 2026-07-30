import { useState, useCallback } from 'react';
import type { GameState, PlayerPiece, Position, ActionLogEntry, Scenario, BlockOutcomeFace } from './types';
import {
  computeReachable, findShortestPath, key, neighbours, catchTargetAt, passTargetAt, computePassRange,
  countAdjacentAssists, blockDiceCount, blockOutcomeProbabilities, blockCombinedProbability, pushBackCandidates,
} from './bfs';

const TURNS_PER_HALF = 8;
const ROWS = 26;

const FREE_PLAY_PIECES: PlayerPiece[] = [
  // Human ball carrier: row 6, col 7 — exactly MA6 from the top end zone (row 0)
  { id: 'human', team: 'human', role: 'thrower', name: 'Aldric Swiftfoot', position: { col: 7, row: 6 }, ma: 6, st: 3, ag: 3, pa: 3, av: 8, skills: ['Block'], activated: false, hasBall: true, down: false },
  { id: 'orc1',  team: 'orc',   role: 'blocker', name: 'Grukk Ironjaw',     position: { col: 6, row: 4 }, ma: 4, st: 3, ag: 3, pa: 6, av: 9, skills: ['Animosity'], activated: false, hasBall: false, down: false },
  { id: 'orc2',  team: 'orc',   role: 'blocker', name: 'Muzgash Skullkrak', position: { col: 8, row: 4 }, ma: 4, st: 3, ag: 3, pa: 6, av: 9, skills: ['Animosity'], activated: false, hasBall: false, down: false },
];

const MAX_GFI = 2;

function makeBlankState(overrides: Partial<GameState> = {}): GameState {
  return {
    pieces: [],
    activeTeam: 'human',
    selectedPieceId: null,
    reachableKeys: new Set(),
    originPos: null,
    committedPath: [],
    walkedSquares: [],
    pathPreview: [],
    remainingMa: 0,
    remainingGfi: 0,
    pendingDodgeTargets: [],
    humanTurn: 1,
    orcTurn: 1,
    half: 1,
    score: { human: 0, orc: 0 },
    phase: 'playing',
    activationLogStart: 0,
    pendingProb: 1,
    actionLog: [],
    isPuzzleMode: false,
    scenarioId: null,
    ballPosition: null,
    passUsed: false,
    pendingHandoff: false,
    isHandoffTargeting: false,
    handoffTargets: new Set(),
    pendingPass: false,
    isPassTargeting: false,
    passRangeKeys: new Map(),
    passReceiverKeys: new Set(),
    blitzUsed: false,
    pendingBlock: false,
    pendingBlockIsBlitz: false,
    isBlockTargeting: false,
    blockTargets: new Set(),
    blockChoice: null,
    pushTargetKeys: new Set(),
    pendingBlockResolution: null,
    ...overrides,
  };
}

export function makeFreePlayState(): GameState {
  return makeBlankState({ pieces: FREE_PLAY_PIECES.map(p => ({ ...p })) });
}

export function makeScenarioState(scenario: Scenario): GameState {
  return makeBlankState({
    pieces: scenario.pieces.map(def => ({ ...def, activated: false, down: def.down ?? false })),
    activeTeam: scenario.activeTeam,
    isPuzzleMode: true,
    scenarioId: scenario.id,
    ballPosition: scenario.ballPosition ?? null,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function successChance(target: number): number {
  return Math.max(0, Math.min(1, (7 - target) / 6));
}

function posKey(p: Position) { return key(p); }

/** Recompute the full reachable set from `fromPos` with `ma` and `gfi` remaining. */
function recomputeReachable(
  state: GameState,
  pieceId: string,
  fromPos: Position,
  ma: number,
  gfi: number = 0,
): Pick<GameState, 'reachableKeys'> {
  const piece = state.pieces.find(p => p.id === pieceId)!;
  const opponents = state.pieces.filter(p => p.team !== piece.team && !p.down).map(p => p.position);
  const others    = state.pieces.filter(p => p.id !== pieceId).map(p => p.position);
  const { reachableKeys } = computeReachable(fromPos, ma, others, opponents, gfi);
  return { reachableKeys };
}

function clearSelection(state: GameState, cancelActivation = false): GameState {
  return {
    ...state,
    selectedPieceId: null,
    reachableKeys: new Set(),
    originPos: null,
    committedPath: [],
    walkedSquares: [],
    pathPreview: [],
    remainingMa: 0,
    remainingGfi: 0,
    pendingDodgeTargets: [],
    pendingProb: 1,
    activationLogStart: 0,
    pendingHandoff: false,
    isHandoffTargeting: false,
    handoffTargets: new Set(),
    pendingPass: false,
    isPassTargeting: false,
    passRangeKeys: new Map(),
    passReceiverKeys: new Set(),
    pendingBlock: false,
    pendingBlockIsBlitz: false,
    isBlockTargeting: false,
    blockTargets: new Set(),
    blockChoice: null,
    pushTargetKeys: new Set(),
    pendingBlockResolution: null,
    actionLog: cancelActivation
      ? state.actionLog.slice(0, state.activationLogStart)
      : state.actionLog,
  };
}

/**
 * Move piece to the last square in committedPath, finalizing hasBall if the
 * activation's walked path crossed the loose ball's square.
 */
function commitMove(state: GameState): GameState['pieces'] {
  if (!state.selectedPieceId || state.committedPath.length === 0) return state.pieces;
  const dest = state.committedPath[state.committedPath.length - 1];
  const pickedUpBall = state.ballPosition !== null &&
    state.walkedSquares.some(p => key(p) === key(state.ballPosition!));
  return state.pieces.map(p =>
    p.id === state.selectedPieceId
      ? { ...p, position: dest, activated: true, hasBall: p.hasBall || pickedUpBall }
      : p
  );
}

function isTouchdownSquare(pos: Position, team: string): boolean {
  return team === 'human' ? pos.row === 0 : pos.row === ROWS - 1;
}

function advanceTurn(state: GameState): GameState {
  const next = { ...state };
  if (state.activeTeam === 'human') {
    next.activeTeam = 'orc';
    next.humanTurn = state.humanTurn + 1;
  } else {
    next.activeTeam = 'human';
    next.orcTurn = state.orcTurn + 1;
  }
  next.pieces = next.pieces.map(p => ({ ...p, activated: false }));
  next.selectedPieceId = null;
  next.reachableKeys = new Set();
  next.originPos = null;
  next.committedPath = [];
  next.walkedSquares = [];
  next.pathPreview = [];
  next.remainingMa = 0;
  next.remainingGfi = 0;
  next.pendingDodgeTargets = [];
  next.pendingProb = 1;
  next.activationLogStart = 0;
  next.actionLog = [];
  next.passUsed = false;
  next.pendingHandoff = false;
  next.isHandoffTargeting = false;
  next.handoffTargets = new Set();
  next.pendingPass = false;
  next.isPassTargeting = false;
  next.passRangeKeys = new Map();
  next.passReceiverKeys = new Set();
  next.blitzUsed = false;
  next.pendingBlock = false;
  next.pendingBlockIsBlitz = false;
  next.isBlockTargeting = false;
  next.blockTargets = new Set();
  next.blockChoice = null;
  next.pushTargetKeys = new Set();
  next.pendingBlockResolution = null;
  if (!state.isPuzzleMode) {
    if (next.humanTurn > TURNS_PER_HALF && next.orcTurn > TURNS_PER_HALF) {
      next.phase = next.half === 1 ? 'half_over' : 'game_over';
    }
  }
  return next;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGameState(initialState: GameState) {
  const [state, setState] = useState<GameState>(initialState);

  /**
   * Called on mouse hover over a square.
   * If a piece is selected, compute the shortest path from the current path tip
   * to the hovered square and store it as pathPreview.
   */
  const handleSquareHover = useCallback((col: number, row: number) => {
    setState(prev => {
      if (prev.phase !== 'playing' || !prev.selectedPieceId) return prev;

      const hovered: Position = { col, row };
      const hoveredKey = posKey(hovered);

      // Only preview if the square is reachable
      if (!prev.reachableKeys.has(hoveredKey)) {
        return { ...prev, pathPreview: [] };
      }

      // Path tip = last committed square, or origin
      const tip = prev.committedPath.length > 0
        ? prev.committedPath[prev.committedPath.length - 1]
        : prev.originPos!;

      const piece = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
      const opponents = prev.pieces.filter(p => p.team !== piece.team && !p.down).map(p => p.position);
      const others    = prev.pieces.filter(p => p.id !== piece.id).map(p => p.position);

      const path = findShortestPath(tip, hovered, prev.remainingMa, others, opponents, piece.ag, prev.remainingGfi, prev.ballPosition);
      return { ...prev, pathPreview: path ?? [] };
    });
  }, []);

  const handleSquareLeave = useCallback(() => {
    setState(prev => ({ ...prev, pathPreview: [] }));
  }, []);

  /**
   * Called on click.
   * - If a piece is selected and the clicked square is reachable:
   *   commit the preview path, deduct MA, recompute reachable from new tip.
   * - If clicking own unactivated piece: select it.
   * - If clicking selected piece: cancel.
   * - Otherwise: deselect.
   */
  const handleSquareClick = useCallback((col: number, row: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;

      const clickedPos: Position = { col, row };
      const clickedKey = posKey(clickedPos);
      const pieceOnSquare = prev.pieces.find(p => posKey(p.position) === clickedKey);

      // End activation: clicked the selected piece, or double-clicked the current path tip
      const pathTip = prev.selectedPieceId
        ? (prev.committedPath.length > 0
            ? prev.committedPath[prev.committedPath.length - 1]
            : prev.originPos)
        : null;
      const clickedTip = pathTip && posKey(pathTip) === clickedKey;

      if (prev.selectedPieceId && (pieceOnSquare?.id === prev.selectedPieceId || clickedTip)) {
        const dest = prev.committedPath.length > 0
          ? prev.committedPath[prev.committedPath.length - 1]
          : null;
        const hasMoved = prev.committedPath.length > 0;

        // Pass declared — move carrier to destination then open pass targeting.
        // If the carrier's path crossed the loose ball's square this activation,
        // finalize the pickup (hasBall + clear the loose ball) before opening
        // targeting, so a piece can pick up a loose ball and immediately pass it.
        if (prev.pendingPass) {
          const carrierPos = dest ?? prev.originPos!;
          const carrier = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
          const pickedUpBall = prev.ballPosition !== null &&
            prev.walkedSquares.some(p => key(p) === key(prev.ballPosition!));

          // Declared Pass but never actually picked up the (loose) ball this
          // activation and didn't already carry it — nothing to throw. End
          // the activation normally without consuming passUsed, same as the
          // zero-valid-receivers case below.
          if (!carrier.hasBall && !pickedUpBall) {
            const pieces = prev.pieces.map(p =>
              p.id === carrier.id ? { ...p, position: carrierPos, activated: true } : p
            );
            return clearSelection({ ...prev, pieces });
          }

          const pieces = prev.pieces.map(p =>
            p.id === prev.selectedPieceId ? { ...p, position: carrierPos, hasBall: p.hasBall || pickedUpBall } : p
          );
          const ballPosition = pickedUpBall ? null : prev.ballPosition;

          const passRangeKeys = computePassRange(carrierPos);

          // Eligible receivers: teammates (not carrier, not already holding the ball)
          // within range. A receiver's own activation state this turn is irrelevant —
          // catching a pass does not require the receiver to be unactivated.
          const passReceiverKeys = new Set<string>();
          for (const k of passRangeKeys.keys()) {
            const piece = pieces.find(p => key(p.position) === k);
            if (piece && piece.team === carrier.team && piece.id !== carrier.id && !piece.hasBall) {
              passReceiverKeys.add(k);
            }
          }

          if (passReceiverKeys.size === 0) {
            // No valid receivers — end the carrier's activation at its final position
            // without consuming passUsed. Marking `activated: true` here is what
            // prevents the carrier from being reselected/moved again this turn.
            const activatedPieces = pieces.map(p =>
              p.id === carrier.id ? { ...p, activated: true } : p
            );
            return clearSelection({ ...prev, pieces: activatedPieces, ballPosition });
          }

          return {
            ...prev,
            pieces,
            ballPosition,
            committedPath: dest ? prev.committedPath : [],
            reachableKeys: new Set(),
            pathPreview: [],
            pendingPass: false,
            isPassTargeting: true,
            passRangeKeys,
            passReceiverKeys,
          };
        }

        // Handoff declared — move carrier to destination then open receiver targeting.
        // If the carrier's path crossed the loose ball's square this activation,
        // finalize the pickup (hasBall + clear the loose ball) before opening
        // targeting, so a piece can pick up a loose ball and immediately hand it off.
        if (prev.pendingHandoff) {
          const carrierPos = dest ?? prev.originPos!;
          const carrier = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
          const pickedUpBall = prev.ballPosition !== null &&
            prev.walkedSquares.some(p => key(p) === key(prev.ballPosition!));

          // Declared Hand Off but never actually picked up the (loose) ball
          // this activation and didn't already carry it — nothing to hand
          // off. End the activation normally without consuming passUsed,
          // same as the zero-valid-targets case below.
          if (!carrier.hasBall && !pickedUpBall) {
            const pieces = prev.pieces.map(p =>
              p.id === carrier.id ? { ...p, position: carrierPos, activated: true } : p
            );
            return clearSelection({ ...prev, pieces });
          }

          // Move carrier to final position
          const pieces = prev.pieces.map(p =>
            p.id === prev.selectedPieceId ? { ...p, position: carrierPos, hasBall: p.hasBall || pickedUpBall } : p
          );
          const ballPosition = pickedUpBall ? null : prev.ballPosition;

          // Find adjacent eligible teammates from the final position. A receiver's
          // own activation state this turn is irrelevant — catching a handoff does
          // not require the receiver to be unactivated.
          const targets = new Set<string>();
          for (const n of neighbours(carrierPos)) {
            const nk = key(n);
            const piece = pieces.find(p => key(p.position) === nk);
            if (piece && piece.team === carrier.team && piece.id !== carrier.id && !piece.hasBall) {
              targets.add(nk);
            }
          }

          if (targets.size === 0) {
            // No valid receivers — end the carrier's activation at its final position
            // without consuming passUsed. Marking `activated: true` here is what
            // prevents the carrier from being reselected/moved again this turn.
            const activatedPieces = pieces.map(p =>
              p.id === carrier.id ? { ...p, activated: true } : p
            );
            return clearSelection({ ...prev, pieces: activatedPieces, ballPosition });
          }

          return {
            ...prev,
            pieces,
            ballPosition,
            committedPath: dest ? prev.committedPath : [],
            reachableKeys: new Set(),
            pathPreview: [],
            pendingHandoff: false,
            isHandoffTargeting: true,
            handoffTargets: targets,
          };
        }

        // Block/Blitz declared — move attacker to destination (Blitz only; plain
        // Block never moves, so committedPath is always empty in that case) then
        // open defender targeting from the final position.
        if (prev.pendingBlock) {
          const attackerPos = dest ?? prev.originPos!;
          const attacker = prev.pieces.find(p => p.id === prev.selectedPieceId)!;

          const pieces = dest
            ? prev.pieces.map(p => p.id === attacker.id ? { ...p, position: attackerPos } : p)
            : prev.pieces;

          // Adjacent opposing, non-down pieces from the final position.
          const targets = new Set<string>();
          for (const n of neighbours(attackerPos)) {
            const nk = key(n);
            const piece = pieces.find(p => key(p.position) === nk);
            if (piece && piece.team !== attacker.team && !piece.down) {
              targets.add(nk);
            }
          }

          if (targets.size === 0) {
            // No valid targets — end the attacker's activation at its final
            // position with no block thrown. blitzUsed is NOT consumed.
            const activatedPieces = pieces.map(p =>
              p.id === attacker.id ? { ...p, activated: true } : p
            );
            return clearSelection({ ...prev, pieces: activatedPieces });
          }

          // pendingBlockIsBlitz is left as-is (set by handleBlockAction) — it's
          // read again once handleBlockTarget resolves dice count/picker.
          return {
            ...prev,
            pieces,
            committedPath: dest ? prev.committedPath : [],
            reachableKeys: new Set(),
            pathPreview: [],
            pendingBlock: false,
            isBlockTargeting: true,
            blockTargets: targets,
          };
        }

        // Normal end-activation — finalize hasBall if the activation's walked
        // path crossed the loose ball's square, and clear the loose ball.
        const pickedUpBall = prev.ballPosition !== null &&
          prev.walkedSquares.some(p => key(p) === key(prev.ballPosition!));
        const pieces = dest
          ? prev.pieces.map(p => p.id === prev.selectedPieceId ? { ...p, position: dest, activated: true, hasBall: p.hasBall || pickedUpBall } : p)
          : prev.pieces.map(p => p.id === prev.selectedPieceId ? { ...p, activated: true, hasBall: p.hasBall || pickedUpBall } : p);
        return clearSelection({
          ...prev,
          pieces,
          ballPosition: pickedUpBall ? null : prev.ballPosition,
        }, !hasMoved);
      }

      // Commit move to a reachable square
      if (prev.selectedPieceId && prev.reachableKeys.has(clickedKey)) {
        const tip = prev.committedPath.length > 0
          ? prev.committedPath[prev.committedPath.length - 1]
          : prev.originPos!;

        const piece = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
        const opponents = prev.pieces.filter(p => p.team !== piece.team && !p.down).map(p => p.position);
        const others    = prev.pieces.filter(p => p.id !== piece.id).map(p => p.position);

        const path = findShortestPath(tip, clickedPos, prev.remainingMa, others, opponents, piece.ag, prev.remainingGfi, prev.ballPosition);
        if (!path || path.length === 0) return prev;

        // Deduct MA and GFI separately
        let newRemainingMa = prev.remainingMa;
        let newRemainingGfi = prev.remainingGfi;
        for (const step of path) {
          if (step.isGfi) {
            newRemainingGfi = Math.max(0, newRemainingGfi - 1);
          } else {
            newRemainingMa = Math.max(0, newRemainingMa - 1);
          }
        }

        const newCommittedPath = [...prev.committedPath, clickedPos];
        const newWalkedSquares = [...prev.walkedSquares, ...path.map(s => s.pos)];

        let runningCumProb = prev.actionLog.length > 0
          ? prev.actionLog[prev.actionLog.length - 1].cumulativeProb : 1;
        let runningPendingProb = prev.pendingProb;
        const newDodgeTargets = [...prev.pendingDodgeTargets];
        const perStepEntries: ActionLogEntry[] = [];

        let fromPos = tip;
        for (const step of path) {
          // GFI = 2+ (5/6 success). Dodge, GFI, and pickup can all stack — multiply probabilities.
          const gfiProb  = step.isGfi ? successChance(2) : 1;
          const dodgeProb = step.dodgeTarget !== null ? successChance(step.dodgeTarget) : 1;
          const pickupProb = step.pickupTarget !== null ? successChance(step.pickupTarget) : 1;
          const stepProb = gfiProb * dodgeProb * pickupProb;
          runningCumProb = runningCumProb * stepProb;

          if (step.isGfi || step.dodgeTarget !== null || step.pickupTarget !== null) {
            runningPendingProb = runningPendingProb * stepProb;
            if (step.dodgeTarget !== null) newDodgeTargets.push(step.dodgeTarget);
          }

          perStepEntries.push({
            kind: 'move',
            pieceName: piece.name,
            pieceRole: piece.role ?? piece.team,
            from: fromPos,
            to: step.pos,
            steps: 1,
            dodgeTarget: step.dodgeTarget,
            isGfi: step.isGfi,
            pickupTarget: step.pickupTarget,
            actionProb: stepProb,
            cumulativeProb: runningCumProb,
          });
          fromPos = step.pos;
        }

        const newPendingProb = runningPendingProb;
        const newActionLog = [...prev.actionLog, ...perStepEntries];

        // A piece carries the ball at the end of this click if it already had
        // it, or if any square walked so far this activation (across all
        // clicks, not just this one) crossed the loose ball's square.
        const pickedUpBallThisActivation = prev.ballPosition !== null &&
          newWalkedSquares.some(p => key(p) === key(prev.ballPosition!));
        const carriesBallThisClick = piece.hasBall || pickedUpBallThisActivation;

        // Touchdown: ball carrier (including one who just picked up the ball
        // this same click, or earlier in the same activation) reached the end
        // zone — this finalizes the piece's position/hasBall and clears the
        // loose ball immediately.
        if (carriesBallThisClick && isTouchdownSquare(clickedPos, piece.team)) {
          const pieces = prev.pieces.map(p =>
            p.id === piece.id ? { ...p, position: clickedPos, activated: true, hasBall: true } : p
          );
          return clearSelection({
            ...prev,
            pieces,
            ballPosition: pickedUpBallThisActivation ? null : prev.ballPosition,
            committedPath: newCommittedPath,
            walkedSquares: newWalkedSquares,
            pendingDodgeTargets: newDodgeTargets,
            pendingProb: newPendingProb,
            actionLog: newActionLog,
            phase: 'touchdown',
          });
        }

        // No MA or GFI left — freeze reachable. Piece position/hasBall/loose-ball
        // are NOT finalized here — that only happens when the activation itself
        // is finalized (end-activation click or handleEndTurn).
        if (newRemainingMa <= 0 && newRemainingGfi <= 0) {
          return {
            ...prev,
            committedPath: newCommittedPath,
            walkedSquares: newWalkedSquares,
            remainingMa: 0,
            remainingGfi: 0,
            reachableKeys: new Set(),
            pathPreview: [],
            pendingDodgeTargets: newDodgeTargets,
            pendingProb: newPendingProb,
            actionLog: newActionLog,
          };
        }

        const { reachableKeys } = recomputeReachable(prev, prev.selectedPieceId, clickedPos, newRemainingMa, newRemainingGfi);

        return {
          ...prev,
          committedPath: newCommittedPath,
          walkedSquares: newWalkedSquares,
          remainingMa: newRemainingMa,
          remainingGfi: newRemainingGfi,
          reachableKeys,
          pathPreview: [],
          pendingDodgeTargets: newDodgeTargets,
          pendingProb: newPendingProb,
          actionLog: newActionLog,
        };
      }

      // Select own unactivated piece (a down piece cannot be selected/activated)
      if (
        pieceOnSquare &&
        pieceOnSquare.team === prev.activeTeam &&
        !pieceOnSquare.activated &&
        !pieceOnSquare.down
      ) {
        const { reachableKeys } = recomputeReachable(prev, pieceOnSquare.id, pieceOnSquare.position, pieceOnSquare.ma, MAX_GFI);
        return {
          ...prev,
          selectedPieceId: pieceOnSquare.id,
          originPos: pieceOnSquare.position,
          committedPath: [],
          walkedSquares: [],
          pathPreview: [],
          remainingMa: pieceOnSquare.ma,
          remainingGfi: MAX_GFI,
          pendingDodgeTargets: [],
          pendingProb: 1,
          reachableKeys,
          activationLogStart: prev.actionLog.length,
        };
      }

      // Deselect (cancel)
      if (prev.selectedPieceId) return clearSelection(prev, true);
      return prev;
    });
  }, []);

  const handleCancelSelection = useCallback(() => {
    setState(prev => {
      if (prev.isHandoffTargeting) {
        return { ...prev, pendingHandoff: false, isHandoffTargeting: false, handoffTargets: new Set() };
      }
      if (prev.isPassTargeting) {
        return { ...prev, pendingPass: false, isPassTargeting: false, passRangeKeys: new Map(), passReceiverKeys: new Set() };
      }
      if (prev.isBlockTargeting) {
        return { ...prev, pendingBlock: false, isBlockTargeting: false, blockTargets: new Set() };
      }
      return prev.selectedPieceId ? clearSelection(prev, true) : prev;
    });
  }, []);

  /**
   * Called when the player clicks "Hand Off" in the PieceMenu.
   * Selects the carrier for normal movement (same as "Move") but sets pendingHandoff.
   * When the player ends the activation, receiver targeting opens automatically.
   */
  const handleHandoffAction = useCallback((pieceId: string) => {
    setState(prev => {
      if (prev.passUsed) return prev;

      // Eligible if the piece already carries the ball, or the ball is
      // currently loose — in that case the player is expected to move this
      // piece onto the loose ball's square (picking it up) before handing off.
      const carrier = prev.pieces.find(p => p.id === pieceId);
      if (!carrier || carrier.activated) return prev;
      if (!carrier.hasBall && prev.ballPosition === null) return prev;

      const { reachableKeys } = recomputeReachable(prev, pieceId, carrier.position, carrier.ma, MAX_GFI);

      return {
        ...prev,
        selectedPieceId: pieceId,
        originPos: carrier.position,
        committedPath: [],
        walkedSquares: [],
        pathPreview: [],
        remainingMa: carrier.ma,
        remainingGfi: MAX_GFI,
        pendingDodgeTargets: [],
        pendingProb: 1,
        reachableKeys,
        activationLogStart: prev.actionLog.length,
        pendingHandoff: true,
        isHandoffTargeting: false,
        handoffTargets: new Set(),
      };
    });
  }, []);

  /**
   * Called when the player clicks a highlighted receiver square during handoff targeting.
   * Executes the handoff: logs the catch roll, transfers the ball, marks carrier activated.
   */
  const handleHandoffTarget = useCallback((col: number, row: number) => {
    setState(prev => {
      if (!prev.isHandoffTargeting || !prev.selectedPieceId) return prev;

      const receiverKey = key({ col, row });
      if (!prev.handoffTargets.has(receiverKey)) return prev;

      const carrier = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
      const receiver = prev.pieces.find(p => key(p.position) === receiverKey)!;

      // Carrier's current position (after any movement this activation)
      const carrierPos = prev.committedPath.length > 0
        ? prev.committedPath[prev.committedPath.length - 1]
        : carrier.position;

      const opponents = prev.pieces.filter(p => p.team !== carrier.team && !p.down).map(p => p.position);
      const catchTarget = catchTargetAt({ col, row }, receiver.ag, opponents);
      const actionProb = successChance(catchTarget);
      const prevCumProb = prev.actionLog.length > 0
        ? prev.actionLog[prev.actionLog.length - 1].cumulativeProb
        : 1;
      const cumulativeProb = prevCumProb * actionProb;

      const handoffEntry: ActionLogEntry = {
        kind: 'handoff',
        pieceName: carrier.name,
        pieceRole: carrier.role ?? carrier.team,
        receiverName: receiver.name,
        receiverRole: receiver.role ?? receiver.team,
        from: carrierPos,
        to: { col, row },
        catchTarget,
        actionProb,
        cumulativeProb,
        dodgeTarget: null,
        isGfi: false,
      };

      // Move carrier to its committed position, mark activated, transfer ball
      const pieces = prev.pieces.map(p => {
        if (p.id === carrier.id) {
          return { ...p, position: carrierPos, activated: true, hasBall: false };
        }
        if (p.id === receiver.id) {
          return { ...p, hasBall: true };
        }
        return p;
      });

      // Touchdown: the receiver caught the handoff in the end zone
      const isTouchdown = isTouchdownSquare(receiver.position, receiver.team);

      return clearSelection({
        ...prev,
        pieces,
        passUsed: true,
        actionLog: [...prev.actionLog, handoffEntry],
        pendingProb: prev.pendingProb * actionProb,
        ...(isTouchdown ? { phase: 'touchdown' as const } : {}),
      });
    });
  }, []);

  /**
   * Called when the player clicks "Pass" in the PieceMenu.
   * Selects the carrier for normal movement with pendingPass: true.
   * When the player ends activation, pass targeting opens.
   */
  const handlePassAction = useCallback((pieceId: string) => {
    setState(prev => {
      if (prev.passUsed) return prev;
      // Eligible if the piece already carries the ball, or the ball is
      // currently loose — in that case the player is expected to move this
      // piece onto the loose ball's square (picking it up) before passing.
      const carrier = prev.pieces.find(p => p.id === pieceId);
      if (!carrier || carrier.activated) return prev;
      if (!carrier.hasBall && prev.ballPosition === null) return prev;

      const { reachableKeys } = recomputeReachable(prev, pieceId, carrier.position, carrier.ma, MAX_GFI);

      return {
        ...prev,
        selectedPieceId: pieceId,
        originPos: carrier.position,
        committedPath: [],
        walkedSquares: [],
        pathPreview: [],
        remainingMa: carrier.ma,
        remainingGfi: MAX_GFI,
        pendingDodgeTargets: [],
        pendingProb: 1,
        reachableKeys,
        activationLogStart: prev.actionLog.length,
        pendingPass: true,
        isPassTargeting: false,
        passRangeKeys: new Map(),
        passReceiverKeys: new Set(),
      };
    });
  }, []);

  /**
   * Called when the player clicks a receiver square during pass targeting.
   * Logs pass roll + catch roll entries, transfers ball, marks carrier activated.
   */
  const handlePassTarget = useCallback((col: number, row: number) => {
    setState(prev => {
      if (!prev.isPassTargeting || !prev.selectedPieceId) return prev;

      const receiverKey = key({ col, row });
      if (!prev.passReceiverKeys.has(receiverKey)) return prev;

      const carrier = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
      const receiver = prev.pieces.find(p => key(p.position) === receiverKey)!;

      const carrierPos = prev.committedPath.length > 0
        ? prev.committedPath[prev.committedPath.length - 1]
        : carrier.position;

      const opponents = prev.pieces.filter(p => p.team !== carrier.team && !p.down).map(p => p.position);

      const passTarget = passTargetAt(carrierPos, carrier.pa, { col, row }, opponents)!;
      const catchTarget = catchTargetAt({ col, row }, receiver.ag, opponents);

      const passProb  = successChance(passTarget);
      const catchProb = successChance(catchTarget);

      const prevCumProb = prev.actionLog.length > 0
        ? prev.actionLog[prev.actionLog.length - 1].cumulativeProb : 1;

      const afterPassCum  = prevCumProb * passProb;
      const afterCatchCum = afterPassCum * catchProb;

      const band = prev.passRangeKeys.get(receiverKey)!;

      const passEntry: ActionLogEntry = {
        kind: 'pass',
        pieceName: carrier.name,
        pieceRole: carrier.role ?? carrier.team,
        receiverName: receiver.name,
        receiverRole: receiver.role ?? receiver.team,
        from: carrierPos,
        to: { col, row },
        passTarget,
        rangeBand: band,
        actionProb: passProb,
        cumulativeProb: afterPassCum,
        dodgeTarget: null,
        isGfi: false,
      };

      const catchEntry: ActionLogEntry = {
        kind: 'pass-catch',
        pieceName: receiver.name,
        pieceRole: receiver.role ?? receiver.team,
        from: { col, row },
        to: { col, row },
        catchTarget,
        actionProb: catchProb,
        cumulativeProb: afterCatchCum,
        dodgeTarget: null,
        isGfi: false,
      };

      const pieces = prev.pieces.map(p => {
        if (p.id === carrier.id)  return { ...p, position: carrierPos, activated: true, hasBall: false };
        if (p.id === receiver.id) return { ...p, hasBall: true };
        return p;
      });

      // Touchdown: the receiver caught the pass in the end zone
      const isTouchdown = isTouchdownSquare(receiver.position, receiver.team);

      return clearSelection({
        ...prev,
        pieces,
        passUsed: true,
        actionLog: [...prev.actionLog, passEntry, catchEntry],
        pendingProb: prev.pendingProb * passProb * catchProb,
        ...(isTouchdown ? { phase: 'touchdown' as const } : {}),
      });
    });
  }, []);

  /**
   * Called when the player clicks "Block"/"Blitz" in the PieceMenu.
   * Blitz allows movement first (pendingBlock: true, same shape as Pass/Handoff);
   * plain Block never moves — it goes straight to defender targeting from the
   * piece's current position.
   */
  const handleBlockAction = useCallback((pieceId: string, isBlitz: boolean) => {
    setState(prev => {
      if (isBlitz && prev.blitzUsed) return prev;

      const attacker = prev.pieces.find(p => p.id === pieceId);
      if (!attacker || attacker.activated || attacker.down) return prev;

      if (isBlitz) {
        const { reachableKeys } = recomputeReachable(prev, pieceId, attacker.position, attacker.ma, MAX_GFI);
        return {
          ...prev,
          selectedPieceId: pieceId,
          originPos: attacker.position,
          committedPath: [],
          walkedSquares: [],
          pathPreview: [],
          remainingMa: attacker.ma,
          remainingGfi: MAX_GFI,
          pendingDodgeTargets: [],
          pendingProb: 1,
          reachableKeys,
          activationLogStart: prev.actionLog.length,
          pendingBlock: true,
          pendingBlockIsBlitz: true,
          isBlockTargeting: false,
          blockTargets: new Set(),
        };
      }

      // Plain Block — no movement, target directly from the current square.
      const targets = new Set<string>();
      for (const n of neighbours(attacker.position)) {
        const nk = key(n);
        const piece = prev.pieces.find(p => key(p.position) === nk);
        if (piece && piece.team !== attacker.team && !piece.down) {
          targets.add(nk);
        }
      }
      if (targets.size === 0) return prev;

      return {
        ...prev,
        selectedPieceId: pieceId,
        originPos: attacker.position,
        committedPath: [],
        walkedSquares: [],
        pathPreview: [],
        remainingMa: 0,
        remainingGfi: 0,
        pendingDodgeTargets: [],
        pendingProb: 1,
        reachableKeys: new Set(),
        activationLogStart: prev.actionLog.length,
        pendingBlock: false,
        pendingBlockIsBlitz: false,
        isBlockTargeting: true,
        blockTargets: targets,
      };
    });
  }, []);

  /**
   * Called when the player clicks a highlighted defender square during block
   * targeting. Computes dice count/picker/outcome probabilities and opens the
   * outcome checklist (no board mutation yet — see handleBlockOutcomeChoice).
   */
  const handleBlockTarget = useCallback((col: number, row: number) => {
    setState(prev => {
      if (!prev.isBlockTargeting || !prev.selectedPieceId) return prev;

      const defenderKey = key({ col, row });
      if (!prev.blockTargets.has(defenderKey)) return prev;

      const attacker = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
      const defender = prev.pieces.find(p => key(p.position) === defenderKey)!;

      const attackerTeammates = prev.pieces.filter(p => p.team === attacker.team)
        .map(p => ({ id: p.id, position: p.position, down: p.down }));
      const defenderTeammates = prev.pieces.filter(p => p.team === defender.team)
        .map(p => ({ id: p.id, position: p.position, down: p.down }));

      const attackerAssists = countAdjacentAssists(attacker.position, attackerTeammates, attacker.id);
      const defenderAssists = countAdjacentAssists(defender.position, defenderTeammates, defender.id);

      const { diceCount, picker } = blockDiceCount(attacker.st, attackerAssists, defender.st, defenderAssists);
      const outcomeProbs = blockOutcomeProbabilities(diceCount, picker);

      return {
        ...prev,
        isBlockTargeting: false,
        blockTargets: new Set(),
        blockChoice: {
          defenderId: defender.id,
          isBlitz: prev.pendingBlockIsBlitz,
          diceCount,
          picker,
          outcomeProbs,
        },
      };
    });
  }, []);

  /**
   * Called once the player confirms their outcome checklist (and, if more
   * than one face was checked, their chosen continuation face). Logs the
   * BlockLogEntry and applies resolvedFace's board effects. Push-producing
   * faces (push / defender-stumbles / defender-down) open a push-square
   * sub-step instead of finishing the activation immediately.
   */
  const handleBlockOutcomeChoice = useCallback((acceptedFaces: BlockOutcomeFace[], resolvedFace: BlockOutcomeFace) => {
    setState(prev => {
      if (!prev.blockChoice || !prev.selectedPieceId) return prev;
      const { defenderId, isBlitz, diceCount, picker, outcomeProbs } = prev.blockChoice;

      const attacker = prev.pieces.find(p => p.id === prev.selectedPieceId)!;
      const defender = prev.pieces.find(p => p.id === defenderId)!;

      const actionProb = blockCombinedProbability(acceptedFaces, diceCount, picker);
      const prevCumProb = prev.actionLog.length > 0
        ? prev.actionLog[prev.actionLog.length - 1].cumulativeProb : 1;
      const cumulativeProb = prevCumProb * actionProb;

      const blockEntry: ActionLogEntry = {
        kind: 'block',
        isBlitz,
        pieceName: attacker.name,
        pieceRole: attacker.role ?? attacker.team,
        receiverName: defender.name,
        receiverRole: defender.role ?? defender.team,
        from: attacker.position,
        to: defender.position,
        diceCount,
        picker,
        outcomeProbs,
        acceptedFaces,
        resolvedFace,
        actionProb,
        cumulativeProb,
        dodgeTarget: null,
        isGfi: false,
      };

      const newActionLog = [...prev.actionLog, blockEntry];
      const newPendingProb = prev.pendingProb * actionProb;
      const newBlitzUsed = isBlitz ? true : prev.blitzUsed;

      if (resolvedFace === 'attacker-down') {
        const pieces = prev.pieces.map(p =>
          p.id === attacker.id ? { ...p, down: true, activated: true } : p
        );
        return clearSelection({
          ...prev, pieces, actionLog: newActionLog, pendingProb: newPendingProb,
          blitzUsed: newBlitzUsed, blockChoice: null,
        });
      }

      if (resolvedFace === 'both-down') {
        const attackerHasBlockSkill = attacker.skills.includes('Block');
        const defenderHasBlockSkill = defender.skills.includes('Block');
        const pieces = prev.pieces.map(p => {
          if (p.id === attacker.id) return { ...p, down: !attackerHasBlockSkill, activated: true };
          if (p.id === defender.id) return { ...p, down: !defenderHasBlockSkill };
          return p;
        });
        return clearSelection({
          ...prev, pieces, actionLog: newActionLog, pendingProb: newPendingProb,
          blitzUsed: newBlitzUsed, blockChoice: null,
        });
      }

      // push / defender-stumbles / defender-down all push the defender back.
      let defenderFalls: boolean;
      if (resolvedFace === 'push') {
        defenderFalls = false;
      } else if (resolvedFace === 'defender-stumbles') {
        const defenderHasDodge = defender.skills.includes('Dodge');
        const attackerHasTackle = attacker.skills.includes('Tackle');
        defenderFalls = !(defenderHasDodge && !attackerHasTackle);
      } else {
        defenderFalls = true; // defender-down
      }

      const allPositions = prev.pieces.map(p => p.position);
      const pushCandidates = pushBackCandidates(attacker.position, defender.position, allPositions);

      if (pushCandidates.length === 0) {
        // No legal square to push into — defender stays in place but still
        // falls per defenderFalls (crowd-push mechanics are out of scope).
        const pieces = prev.pieces.map(p => {
          if (p.id === defender.id) return { ...p, down: defenderFalls };
          if (p.id === attacker.id) return { ...p, activated: true };
          return p;
        });
        return clearSelection({
          ...prev, pieces, actionLog: newActionLog, pendingProb: newPendingProb,
          blitzUsed: newBlitzUsed, blockChoice: null,
        });
      }

      const pushTargetKeys = new Set(pushCandidates.map(key));
      return {
        ...prev,
        actionLog: newActionLog,
        pendingProb: newPendingProb,
        blitzUsed: newBlitzUsed,
        blockChoice: null,
        pushTargetKeys,
        pendingBlockResolution: {
          attackerId: attacker.id,
          defenderId: defender.id,
          resolvedFace,
          defenderFalls,
          defenderFrom: defender.position,
          offerFollowUp: resolvedFace === 'defender-down',
        },
      };
    });
  }, []);

  /**
   * Called once the player picks a push-back square (and, for a Defender
   * Down resolution, a follow-up choice). Finalizes the defender's position
   * and down state, optionally moves the attacker into the vacated square,
   * and ends the attacker's activation.
   */
  const handlePushChoice = useCallback((col: number, row: number, followUp: boolean) => {
    setState(prev => {
      if (!prev.pendingBlockResolution) return prev;
      const resolution = prev.pendingBlockResolution;
      const targetKey = key({ col, row });
      if (!prev.pushTargetKeys.has(targetKey)) return prev;

      const pieces = prev.pieces.map(p => {
        if (p.id === resolution.defenderId) {
          return { ...p, position: { col, row }, down: resolution.defenderFalls };
        }
        if (p.id === resolution.attackerId) {
          return {
            ...p,
            position: resolution.offerFollowUp && followUp ? resolution.defenderFrom : p.position,
            activated: true,
          };
        }
        return p;
      });

      return clearSelection({
        ...prev,
        pieces,
        pendingBlockResolution: null,
        pushTargetKeys: new Set(),
      });
    });
  }, []);

  const handleEndTurn = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;

      const pieces = prev.committedPath.length > 0 ? commitMove(prev) : prev.pieces;

      // commitMove finalizes hasBall if the activation's walked path crossed
      // the loose ball's square — clear the loose ball to match.
      const pickedUpBall = prev.ballPosition !== null &&
        prev.walkedSquares.some(p => key(p) === key(prev.ballPosition!));
      const ballPosition = pickedUpBall ? null : prev.ballPosition;

      // Check if the ball carrier just reached the end zone
      const ballCarrier = pieces.find(p => p.hasBall && p.team === prev.activeTeam);
      if (ballCarrier && isTouchdownSquare(ballCarrier.position, ballCarrier.team)) {
        return clearSelection({ ...prev, pieces, ballPosition, phase: 'touchdown' });
      }

      return advanceTurn({ ...prev, pieces, ballPosition });
    });
  }, []);

  const handleContinue = useCallback(() => {
    setState(prev => {
      if (prev.phase === 'half_over') return { ...makeFreePlayState(), half: 2 as const, score: prev.score, activeTeam: 'orc' as const };
      if (prev.phase === 'game_over') return makeFreePlayState();
      return prev;
    });
  }, []);

  return {
    state, setState, handleSquareClick, handleSquareHover, handleSquareLeave, handleCancelSelection,
    handleEndTurn, handleContinue, handleHandoffAction, handleHandoffTarget, handlePassAction, handlePassTarget,
    handleBlockAction, handleBlockTarget, handleBlockOutcomeChoice, handlePushChoice,
  };
}
