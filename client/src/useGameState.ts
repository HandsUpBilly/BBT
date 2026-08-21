import { useState, useCallback } from 'react';
import type { GameState, PlayerPiece, Position, ActionLogEntry, Scenario, BlockOutcomeFace } from './types';
import type { PathStep } from './bfs';
import type { BlockBoardState } from './blockBranching';
import {
  computeReachable, findShortestPath, key, fromKey, neighbours, catchTargetAt, passTargetAt, computePassRange,
  rangeBandForPass, countEligibleAssists, blockDiceCount, blockOutcomeProbabilities, blockCombinedProbability,
  pushBackCandidates,
} from './bfs';

/**
 * A puzzle is always exactly one turn — that is the core of the game. There is
 * no End Turn, no turn counter, and no second half: you get one activation per
 * piece and the run ends when the ball reaches the end zone. Anything that
 * would let a player bank a turn and start fresh would also reset the
 * probability chain that *is* the score, so keep it that way.
 */

const ROWS = 26;
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
    dodgeRerollAvailability: 0,
    phase: 'playing',
    activationLogStart: 0,
    activationSnapshot: null,
    pendingProb: 1,
    actionLog: [],
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
    blitzResumeId: null,
    pendingBlock: false,
    pendingBlockIsBlitz: false,
    blitzTargetId: null,
    isBlockTargeting: false,
    blockTargets: new Set(),
    blockChoice: null,
    pushTargetKeys: new Set(),
    pendingBlockResolution: null,
    ...overrides,
  };
}

/** Empty board used before a scenario is chosen. */
export function makeEmptyState(): GameState {
  return makeBlankState();
}

export function makeScenarioState(scenario: Scenario): GameState {
  return makeBlankState({
    pieces: scenario.pieces.map(def => ({ ...def, activated: false, down: def.down ?? false })),
    activeTeam: scenario.activeTeam,
    scenarioId: scenario.id,
    ballPosition: scenario.ballPosition ?? null,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function successChance(target: number): number {
  return Math.max(0, Math.min(1, (7 - target) / 6));
}

/**
 * Score one dodge while preserving the exact state of a single skill reroll.
 *
 * `rerollAvailability` is the fraction of successful histories reaching this
 * dodge in which the reroll has not already been consumed. The returned
 * chance is therefore conditional on the run having succeeded so far, which
 * lets each action-log probability continue to multiply into the exact score.
 */
export function dodgeChance(
  target: number,
  rerollAvailability: number,
): { chance: number; nextAvailability: number } {
  const baseChance = successChance(target);
  const available = Math.max(0, Math.min(1, rerollAvailability));
  const chance = baseChance * (1 + available * (1 - baseChance));
  const nextAvailability = chance > 0 ? (available * baseChance) / chance : 0;
  return { chance, nextAvailability };
}

/**
 * Combined success chance of every roll along a previewed path.
 *
 * The committed probability is only accumulated when a move is actually
 * clicked, so before this the numeric odds of a planned route were not
 * available anywhere — the board showed the dice faces but never the product.
 * That was survivable with a mouse, where hovering costs nothing and the
 * player can back out. On touch the commit bar has to state the odds it is
 * asking the player to accept.
 *
 * Deliberately mirrors the per-step maths in handleSquareClick: GFI is a 2+,
 * and GFI, dodge and pickup rolls on one square all stack.
 */
export function pathPreviewProb(path: readonly PathStep[], dodgeRerollAvailability = 0): number {
  let prob = 1;
  let rerollAvailability = dodgeRerollAvailability;
  for (const step of path) {
    if (step.isGfi) prob *= successChance(2);
    if (step.dodgeTarget !== null) {
      const dodge = dodgeChance(step.dodgeTarget, rerollAvailability);
      prob *= dodge.chance;
      rerollAvailability = dodge.nextAvailability;
    }
    if (step.pickupTarget !== null) prob *= successChance(step.pickupTarget);
  }
  return prob;
}

/** Recompute the full reachable set from `fromPos` with `ma` and `gfi` remaining. */
function recomputeReachable(
  state: GameState,
  pieceId: string,
  fromPos: Position,
  ma: number,
  gfi: number = 0,
): Pick<GameState, 'reachableKeys'> {
  const piece = state.pieces.find(p => p.id === pieceId);
  if (!piece) return { reachableKeys: new Set() };
  const opponents = state.pieces.filter(p => p.team !== piece.team && !p.down).map(p => p.position);
  const others    = state.pieces.filter(p => p.id !== pieceId).map(p => p.position);
  const { reachableKeys } = computeReachable(fromPos, ma, others, opponents, gfi);
  return { reachableKeys };
}

/**
 * Snapshot taken the moment a piece is activated, so cancelling an activation
 * can restore the board exactly.
 *
 * This matters because several sub-steps (Blitz movement, loose-ball pickup)
 * commit to `pieces`/`ballPosition` before the activation finishes. Without a
 * snapshot, cancelling rolled the action log back — refunding the probability
 * cost — while leaving the piece at its new square and still unactivated, which
 * was a free-movement exploit against the score.
 */
function takeSnapshot(state: GameState, remainingMa: number, remainingGfi: number): GameState['activationSnapshot'] {
  return { pieces: state.pieces, ballPosition: state.ballPosition, remainingMa, remainingGfi };
}

/**
 * Clears the current selection.
 *
 * `cancelActivation` means the player backed out: the action log is truncated
 * to where the activation began AND the board is restored from the snapshot, so
 * no movement, pickup, or push survives a cancel.
 */
function clearSelection(state: GameState, cancelActivation = false): GameState {
  const restored = cancelActivation && state.activationSnapshot
    ? { pieces: state.activationSnapshot.pieces, ballPosition: state.activationSnapshot.ballPosition }
    : { pieces: state.pieces, ballPosition: state.ballPosition };

  // Deselecting the piece still spending its post-Blitz leftover movement is a
  // pause, not a true cancel — the block already resolved and committed. Keep
  // it resumable with the MA/GFI it actually had left, instead of wiping the
  // marker and letting a later reselect grant a fresh full MA pool. See #191.
  const isBlitzPause = cancelActivation
    && state.blitzResumeId !== null
    && state.blitzResumeId === state.selectedPieceId
    && state.activationSnapshot !== null;

  return {
    ...state,
    ...restored,
    selectedPieceId: null,
    reachableKeys: new Set(),
    originPos: null,
    committedPath: [],
    walkedSquares: [],
    pathPreview: [],
    remainingMa: isBlitzPause ? state.activationSnapshot!.remainingMa : 0,
    remainingGfi: isBlitzPause ? state.activationSnapshot!.remainingGfi : 0,
    pendingDodgeTargets: [],
    dodgeRerollAvailability: 0,
    pendingProb: 1,
    activationLogStart: 0,
    activationSnapshot: isBlitzPause ? state.activationSnapshot : null,
    blitzResumeId: isBlitzPause ? state.blitzResumeId : null,
    pendingHandoff: false,
    isHandoffTargeting: false,
    handoffTargets: new Set(),
    pendingPass: false,
    isPassTargeting: false,
    passRangeKeys: new Map(),
    passReceiverKeys: new Set(),
    pendingBlock: false,
    pendingBlockIsBlitz: false,
    blitzTargetId: null,
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

/** State common to every "this piece is now activated" entry point. */
function beginActivation(
  state: GameState,
  piece: PlayerPiece,
  ma: number,
  gfi: number,
  reachableKeys: Set<string>,
): GameState {
  return {
    ...state,
    selectedPieceId: piece.id,
    originPos: piece.position,
    committedPath: [],
    walkedSquares: [],
    pathPreview: [],
    remainingMa: ma,
    remainingGfi: gfi,
    pendingDodgeTargets: [],
    dodgeRerollAvailability: piece.skills.includes('Dodge') ? 1 : 0,
    pendingProb: 1,
    reachableKeys,
    activationLogStart: state.actionLog.length,
    activationSnapshot: takeSnapshot(state, ma, gfi),
    blitzResumeId: null,
  };
}

function resumeMovementAfterBlitz(
  state: GameState,
  pieces: PlayerPiece[],
  attackerId: string,
): GameState {
  const attacker = pieces.find(piece => piece.id === attackerId);
  if (!attacker) return clearSelection({ ...state, pieces });

  const stateWithPieces = { ...state, pieces };
  const reachableKeys = state.remainingMa > 0 || state.remainingGfi > 0
    ? recomputeReachable(
        stateWithPieces,
        attackerId,
        attacker.position,
        state.remainingMa,
        state.remainingGfi,
      ).reachableKeys
    : new Set<string>();

  return {
    ...stateWithPieces,
    selectedPieceId: attackerId,
    originPos: attacker.position,
    committedPath: [],
    walkedSquares: [],
    pathPreview: [],
    reachableKeys,
    pendingBlock: false,
    pendingBlockIsBlitz: false,
    blitzTargetId: null,
    isBlockTargeting: false,
    blockTargets: new Set(),
    blockChoice: null,
    pushTargetKeys: new Set(),
    pendingBlockResolution: null,
    activationLogStart: state.actionLog.length,
    // The block is resolved and irreversible; from here on a cancel should only
    // undo the movement that follows it, so re-baseline the snapshot.
    activationSnapshot: {
      pieces,
      ballPosition: state.ballPosition,
      remainingMa: state.remainingMa,
      remainingGfi: state.remainingGfi,
    },
    // Marks this piece as mid-leftover-movement so switching to a different
    // piece finalizes it instead of leaving it reselectable later — see #161.
    blitzResumeId: attackerId,
  };
}

function isTouchdownSquare(pos: Position, team: string): boolean {
  return team === 'human' ? pos.row === 0 : pos.row === ROWS - 1;
}

/**
 * A player knocked down loses the ball where they stand (BB2020: the ball
 * bounces from the square). Scatter isn't simulated — the ball simply becomes
 * loose on that square, which is what the pickup rules already handle.
 *
 * Returns the updated pieces plus the resulting loose-ball position, if any.
 */
function dropBallIfCarrying(
  pieces: PlayerPiece[],
  ballPosition: Position | null,
  knockedDownIds: string[],
): { pieces: PlayerPiece[]; ballPosition: Position | null } {
  const dropper = pieces.find(p => knockedDownIds.includes(p.id) && p.hasBall);
  if (!dropper) return { pieces, ballPosition };
  return {
    pieces: pieces.map(p => (p.id === dropper.id ? { ...p, hasBall: false } : p)),
    ballPosition: dropper.position,
  };
}

// ── Click intent ─────────────────────────────────────────────────────────────

/**
 * What a click on a square means for a given board.
 *
 * Split out from the reducer so a click can be *replayed* into a sibling branch
 * and checked for meaning the same thing there — see spec.md, "Block Outcomes
 * as Board-State Branches". A pushed-but-standing defender projects a tackle
 * zone that a pushed-and-down one does not, so the same click can be a legal
 * move in one branch and unreachable in another. Lockstep replay has to notice
 * that rather than quietly doing something else, which is exactly what happens
 * if you replay a raw click: an unreachable square falls through to "deselect".
 *
 * `handleSquareClick` switches on this, so the two cannot drift apart.
 */
export type ClickIntent =
  | 'end-activation'
  | 'commit-move'
  | 'select-piece'
  | 'deselect'
  | 'none';

export function classifyClick(state: GameState, pos: Position): ClickIntent {
  if (state.phase !== 'playing') return 'none';

  const clickedKey = key(pos);
  const pieceOnSquare = state.pieces.find(p => key(p.position) === clickedKey);

  // End activation: clicked the selected piece or the already-plotted path tip.
  const pathTip = state.selectedPieceId
    ? (state.committedPath.length > 0
        ? state.committedPath[state.committedPath.length - 1]
        : state.originPos)
    : null;
  const clickedTip = pathTip !== null && key(pathTip) === clickedKey;

  if (state.selectedPieceId && (pieceOnSquare?.id === state.selectedPieceId || clickedTip)) {
    // A Blitz stays active until the chosen defender is clicked from an
    // adjacent square. Clicking the attacker/path tip must not prematurely
    // end the activation while the block is still pending.
    return state.pendingBlock ? 'none' : 'end-activation';
  }

  if (state.selectedPieceId && state.reachableKeys.has(clickedKey)) return 'commit-move';

  // Select own unactivated piece (a down piece cannot be selected/activated)
  if (
    pieceOnSquare
    && pieceOnSquare.team === state.activeTeam
    && !pieceOnSquare.activated
    && !pieceOnSquare.down
  ) {
    return 'select-piece';
  }

  if (state.selectedPieceId) return 'deselect';
  return 'none';
}

/**
 * Finalize the selected piece's activation at its committed destination.
 *
 * Handles the three declared-action shapes that end movement — pass, handoff,
 * and a plain move — including finalizing a loose-ball pickup whose square the
 * activation walked across.
 */
function endActivation(prev: GameState): GameState {
  const dest = prev.committedPath.length > 0
    ? prev.committedPath[prev.committedPath.length - 1]
    : null;
  const hasMoved = prev.committedPath.length > 0;
  const selected = prev.pieces.find(p => p.id === prev.selectedPieceId);
  if (!selected) return clearSelection(prev, true);

  // Pass declared — move carrier to destination then open pass targeting.
  // If the carrier's path crossed the loose ball's square this activation,
  // finalize the pickup (hasBall + clear the loose ball) before opening
  // targeting, so a piece can pick up a loose ball and immediately pass it.
  if (prev.pendingPass) {
    const carrierPos = dest ?? prev.originPos;
    if (!carrierPos) return clearSelection(prev, true);
    const carrier = selected;
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
      p.id === carrier.id ? { ...p, position: carrierPos, hasBall: p.hasBall || pickedUpBall } : p
    );
    const ballPosition = pickedUpBall ? null : prev.ballPosition;

    const passRangeKeys = computePassRange(carrierPos);

    // Eligible receivers: teammates (not carrier, not already holding the ball)
    // within range. A receiver's own activation state this turn is irrelevant —
    // catching a pass does not require the receiver to be unactivated.
    const passReceiverKeys = new Set<string>();
    for (const k of passRangeKeys.keys()) {
      const piece = pieces.find(p => key(p.position) === k);
      if (piece && piece.team === carrier.team && piece.id !== carrier.id && !piece.hasBall && !piece.down) {
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
  // Same loose-ball pickup finalization as the pass branch above.
  if (prev.pendingHandoff) {
    const carrierPos = dest ?? prev.originPos;
    if (!carrierPos) return clearSelection(prev, true);
    const carrier = selected;
    const pickedUpBall = prev.ballPosition !== null &&
      prev.walkedSquares.some(p => key(p) === key(prev.ballPosition!));

    if (!carrier.hasBall && !pickedUpBall) {
      const pieces = prev.pieces.map(p =>
        p.id === carrier.id ? { ...p, position: carrierPos, activated: true } : p
      );
      return clearSelection({ ...prev, pieces });
    }

    // Move carrier to final position
    const pieces = prev.pieces.map(p =>
      p.id === carrier.id ? { ...p, position: carrierPos, hasBall: p.hasBall || pickedUpBall } : p
    );
    const ballPosition = pickedUpBall ? null : prev.ballPosition;

    // Find adjacent eligible teammates from the final position. A receiver's
    // own activation state this turn is irrelevant — catching a handoff does
    // not require the receiver to be unactivated.
    const targets = new Set<string>();
    for (const n of neighbours(carrierPos)) {
      const nk = key(n);
      const piece = pieces.find(p => key(p.position) === nk);
      if (piece && piece.team === carrier.team && piece.id !== carrier.id && !piece.hasBall && !piece.down) {
        targets.add(nk);
      }
    }

    if (targets.size === 0) {
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

  // Normal end-activation — finalize hasBall if the activation's walked
  // path crossed the loose ball's square, and clear the loose ball.
  const pickedUpBall = prev.ballPosition !== null &&
    prev.walkedSquares.some(p => key(p) === key(prev.ballPosition!));
  const pieces = prev.pieces.map(p => {
    if (p.id !== prev.selectedPieceId) return p;
    return {
      ...p,
      ...(dest ? { position: dest } : {}),
      activated: true,
      hasBall: p.hasBall || pickedUpBall,
    };
  });
  return clearSelection({
    ...prev,
    pieces,
    ballPosition: pickedUpBall ? null : prev.ballPosition,
  }, !hasMoved);
}

/**
 * Commit movement to a reachable square, logging one entry per step so each
 * dodge / GFI / pickup roll carries its own probability.
 */
function commitMove(prev: GameState, clickedPos: Position): GameState {
  const tip = prev.committedPath.length > 0
    ? prev.committedPath[prev.committedPath.length - 1]
    : prev.originPos;
  const piece = prev.pieces.find(p => p.id === prev.selectedPieceId);
  if (!tip || !piece) return prev;

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
  let runningDodgeRerollAvailability = prev.dodgeRerollAvailability;
  const newDodgeTargets = [...prev.pendingDodgeTargets];
  const perStepEntries: ActionLogEntry[] = [];

  let fromPos = tip;
  for (const step of path) {
    // GFI = 2+ (5/6 success). Dodge, GFI, and pickup can all stack — multiply probabilities.
    const gfiProb  = step.isGfi ? successChance(2) : 1;
    const dodge = step.dodgeTarget !== null
      ? dodgeChance(step.dodgeTarget, runningDodgeRerollAvailability)
      : null;
    const dodgeProb = dodge?.chance ?? 1;
    const pickupProb = step.pickupTarget !== null ? successChance(step.pickupTarget) : 1;
    const stepProb = gfiProb * dodgeProb * pickupProb;
    const dodgeSkillReroll = step.dodgeTarget !== null && runningDodgeRerollAvailability > 0;
    if (dodge) runningDodgeRerollAvailability = dodge.nextAvailability;
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
      dodgeSkillReroll,
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
      dodgeRerollAvailability: runningDodgeRerollAvailability,
      pendingProb: newPendingProb,
      actionLog: newActionLog,
      phase: 'touchdown',
    });
  }

  // No MA or GFI left — freeze reachable. Piece position/hasBall/loose-ball
  // are NOT finalized here — that only happens when the activation itself
  // is finalized by the end-activation click.
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
      dodgeRerollAvailability: runningDodgeRerollAvailability,
      pendingProb: newPendingProb,
      actionLog: newActionLog,
    };
  }

  const { reachableKeys } = recomputeReachable(prev, prev.selectedPieceId!, clickedPos, newRemainingMa, newRemainingGfi);

  return {
    ...prev,
    committedPath: newCommittedPath,
    walkedSquares: newWalkedSquares,
    remainingMa: newRemainingMa,
    remainingGfi: newRemainingGfi,
    reachableKeys,
    pathPreview: [],
    pendingDodgeTargets: newDodgeTargets,
    dodgeRerollAvailability: runningDodgeRerollAvailability,
    pendingProb: newPendingProb,
    actionLog: newActionLog,
  };
}

/** Begin an activation for the (own, standing, unactivated) piece on `pos`. */
function selectPiece(prev: GameState, pos: Position): GameState {
  const clickedKey = key(pos);
  const pieceOnSquare = prev.pieces.find(p => key(p.position) === clickedKey);
  if (!pieceOnSquare) return prev;

  // Reselecting the piece still paused mid-post-Blitz leftover movement
  // resumes it with whatever MA/GFI it actually had left, not a fresh full
  // pool. See #191.
  if (prev.blitzResumeId === pieceOnSquare.id) {
    return resumeMovementAfterBlitz(prev, prev.pieces, pieceOnSquare.id);
  }

  // If a different piece is still spending its post-Blitz leftover
  // movement (block already resolved and committed), finalize it
  // before switching — otherwise it stays reselectable later with a
  // fresh full MA pool instead of its turn actually ending. See #161.
  const basePrev = prev.blitzResumeId && prev.blitzResumeId !== pieceOnSquare.id
    ? {
        ...prev,
        pieces: prev.pieces.map(p => p.id === prev.blitzResumeId ? { ...p, activated: true } : p),
        blitzResumeId: null,
      }
    : prev;

  const { reachableKeys } = recomputeReachable(basePrev, pieceOnSquare.id, pieceOnSquare.position, pieceOnSquare.ma, MAX_GFI);
  return beginActivation(basePrev, pieceOnSquare, pieceOnSquare.ma, MAX_GFI, reachableKeys);
}

/**
 * Apply a click to a board, as `handleSquareClick` would. Exported so branch
 * replay can drive a sibling board without going through React state.
 */
export function applyClick(state: GameState, pos: Position): GameState {
  switch (classifyClick(state, pos)) {
    case 'end-activation': return endActivation(state);
    case 'commit-move':    return commitMove(state, pos);
    case 'select-piece':   return selectPiece(state, pos);
    case 'deselect':       return clearSelection(state, true);
    case 'none':           return state;
  }
}

/** Pure body of `handleCancelSelection`, so a whole lockstep group can rewind. */
export function applyCancelSelection(state: GameState): GameState {
  // Backing out of receiver targeting keeps the carrier selected so the
  // player can pick a different action; everything else is a full cancel,
  // which also rewinds the board via the activation snapshot.
  if (state.isHandoffTargeting) {
    return { ...state, pendingHandoff: false, isHandoffTargeting: false, handoffTargets: new Set() };
  }
  if (state.isPassTargeting) {
    return { ...state, pendingPass: false, isPassTargeting: false, passRangeKeys: new Map(), passReceiverKeys: new Set() };
  }
  return state.selectedPieceId ? clearSelection(state, true) : state;
}

/**
 * Rewind only the route being plotted while keeping the same activation open.
 *
 * The red movement control means "plot again", not "cancel this player". Any
 * provisional moves, rolls, or pickup are restored from the activation
 * snapshot, while the declared action (Move, Pass, Hand-off, or Blitz) stays
 * selected so the coach can immediately choose a different route.
 */
export function applyResetMovement(state: GameState): GameState {
  if (!state.selectedPieceId || !state.activationSnapshot) return state;

  const snapshot = state.activationSnapshot;
  const selectedPiece = snapshot.pieces.find(piece => piece.id === state.selectedPieceId);
  if (!selectedPiece) return state;
  const restoredState = {
    ...state,
    pieces: snapshot.pieces,
    ballPosition: snapshot.ballPosition,
  };
  const { reachableKeys } = recomputeReachable(
    restoredState,
    selectedPiece.id,
    selectedPiece.position,
    snapshot.remainingMa,
    snapshot.remainingGfi,
  );

  return {
    ...restoredState,
    originPos: selectedPiece.position,
    reachableKeys,
    committedPath: [],
    walkedSquares: [],
    pathPreview: [],
    remainingMa: snapshot.remainingMa,
    remainingGfi: snapshot.remainingGfi,
    pendingDodgeTargets: [],
    dodgeRerollAvailability: selectedPiece.skills.includes('Dodge') ? 1 : 0,
    pendingProb: 1,
    actionLog: state.actionLog.slice(0, state.activationLogStart),
  };
}

/** Pure hover preview used by both the one-board hook and Parallel Universes. */
export function applySquareHover(prev: GameState, hovered: Position): GameState {
  if (prev.phase !== 'playing' || !prev.selectedPieceId) return prev;
  if (!prev.reachableKeys.has(key(hovered))) {
    return prev.pathPreview.length === 0 ? prev : { ...prev, pathPreview: [] };
  }

  const tip = prev.committedPath.length > 0
    ? prev.committedPath[prev.committedPath.length - 1]
    : prev.originPos;
  const piece = prev.pieces.find(p => p.id === prev.selectedPieceId);
  if (!tip || !piece) return prev;

  const opponents = prev.pieces.filter(p => p.team !== piece.team && !p.down).map(p => p.position);
  const others = prev.pieces.filter(p => p.id !== piece.id).map(p => p.position);
  const path = findShortestPath(
    tip, hovered, prev.remainingMa, others, opponents,
    piece.ag, prev.remainingGfi, prev.ballPosition,
  );
  return { ...prev, pathPreview: path ?? [] };
}

export function applySquareLeave(prev: GameState): GameState {
  return prev.pathPreview.length === 0 ? prev : { ...prev, pathPreview: [] };
}

/** Pure body of `handlePushChoice`, so a push can be replayed across branches. */
export function applyPushChoice(prev: GameState, pos: Position, followUp: boolean): GameState {
  if (!prev.pendingBlockResolution) return prev;
  const resolution = prev.pendingBlockResolution;
  const targetKey = key(pos);
  if (!prev.pushTargetKeys.has(targetKey)) return prev;

  const attacker = prev.pieces.find(p => p.id === resolution.attackerId);
  const attackerFollowsUp = resolution.offerFollowUp && followUp;

  const pushed = prev.pieces.map(p => {
    if (p.id === resolution.defenderId) {
      return { ...p, position: pos, down: resolution.defenderFalls };
    }
    if (p.id === resolution.attackerId) {
      return {
        ...p,
        position: attackerFollowsUp ? resolution.defenderFrom : p.position,
        activated: !resolution.isBlitz,
      };
    }
    return p;
  });

  // A pushed-and-downed carrier drops the ball on the square it lands in.
  const { pieces, ballPosition } = dropBallIfCarrying(
    pushed, prev.ballPosition, resolution.defenderFalls ? [resolution.defenderId] : [],
  );

  // Record the push destination on the block entry that produced it, so the
  // pushed-from/pushed-to indicator can be derived from actionLog alone —
  // same convention as the resolved-face marker, persisting after the
  // activation ends and clearing automatically if a cancel rolls the block
  // entry back out of the log.
  const blockEntryIndex = prev.actionLog.findLastIndex(entry => entry.kind === 'block');
  const loggedPush = blockEntryIndex === -1
    ? prev.actionLog
    : prev.actionLog.map((entry, index) =>
        index === blockEntryIndex ? { ...entry, pushTo: pos } : entry,
      );

  // Log the follow-up as a free move step so the committed-movement
  // trail extends into the vacated square, matching the attacker's
  // actual final position.
  const cumulativeProb = loggedPush.length > 0
    ? loggedPush[loggedPush.length - 1].cumulativeProb : 1;
  const actionLog = attackerFollowsUp && attacker
    ? [...loggedPush, {
        kind: 'move' as const,
        pieceName: attacker.name,
        pieceRole: attacker.role ?? attacker.team,
        from: attacker.position,
        to: resolution.defenderFrom,
        steps: 1,
        dodgeTarget: null,
        isGfi: false,
        pickupTarget: null,
        actionProb: 1,
        cumulativeProb,
      }]
    : loggedPush;

  const nextState = {
    ...prev,
    pieces,
    ballPosition,
    actionLog,
    pendingBlockResolution: null,
    pushTargetKeys: new Set<string>(),
  };
  return resolution.isBlitz
    ? resumeMovementAfterBlitz(nextState, pieces, resolution.attackerId)
    : clearSelection(nextState);
}

/**
 * Declare a Hand Off: select the carrier for normal movement, then open
 * receiver targeting once the activation ends.
 */
export function applyHandoffAction(prev: GameState, pieceId: string): GameState {
  if (prev.passUsed) return prev;

  // Eligible if the piece already carries the ball, or the ball is
  // currently loose — in that case the player is expected to move this
  // piece onto the loose ball's square (picking it up) before handing off.
  const carrier = prev.pieces.find(p => p.id === pieceId);
  if (!carrier || carrier.activated || carrier.down) return prev;
  if (!carrier.hasBall && prev.ballPosition === null) return prev;

  const { reachableKeys } = recomputeReachable(prev, pieceId, carrier.position, carrier.ma, MAX_GFI);

  return {
    ...beginActivation(prev, carrier, carrier.ma, MAX_GFI, reachableKeys),
    pendingHandoff: true,
    isHandoffTargeting: false,
    handoffTargets: new Set(),
  };
}

/** Execute a hand off: log the catch roll, transfer the ball, end the activation. */
export function applyHandoffTarget(prev: GameState, pos: Position): GameState {
  if (!prev.isHandoffTargeting || !prev.selectedPieceId) return prev;

  const receiverKey = key(pos);
  if (!prev.handoffTargets.has(receiverKey)) return prev;

  const carrier = prev.pieces.find(p => p.id === prev.selectedPieceId);
  const receiver = prev.pieces.find(p => key(p.position) === receiverKey);
  if (!carrier || !receiver) return prev;

  // Carrier's current position (after any movement this activation)
  const carrierPos = prev.committedPath.length > 0
    ? prev.committedPath[prev.committedPath.length - 1]
    : carrier.position;

  const opponents = prev.pieces.filter(p => p.team !== carrier.team && !p.down).map(p => p.position);
  const catchTarget = catchTargetAt(pos, receiver.ag, opponents);
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
    to: pos,
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
}

/** Declare a Pass: same as Move, but pass targeting opens when movement ends. */
export function applyPassAction(prev: GameState, pieceId: string): GameState {
  if (prev.passUsed) return prev;
  // Eligible if the piece already carries the ball, or the ball is
  // currently loose — in that case the player is expected to move this
  // piece onto the loose ball's square (picking it up) before passing.
  const carrier = prev.pieces.find(p => p.id === pieceId);
  if (!carrier || carrier.activated || carrier.down) return prev;
  if (!carrier.hasBall && prev.ballPosition === null) return prev;

  const { reachableKeys } = recomputeReachable(prev, pieceId, carrier.position, carrier.ma, MAX_GFI);

  return {
    ...beginActivation(prev, carrier, carrier.ma, MAX_GFI, reachableKeys),
    pendingPass: true,
    isPassTargeting: false,
    passRangeKeys: new Map(),
    passReceiverKeys: new Set(),
  };
}

/** Execute a pass: log the pass and catch rolls, transfer the ball. */
export function applyPassTarget(prev: GameState, pos: Position): GameState {
  if (!prev.isPassTargeting || !prev.selectedPieceId) return prev;

  const receiverKey = key(pos);
  if (!prev.passReceiverKeys.has(receiverKey)) return prev;

  const carrier = prev.pieces.find(p => p.id === prev.selectedPieceId);
  const receiver = prev.pieces.find(p => key(p.position) === receiverKey);
  if (!carrier || !receiver) return prev;

  const carrierPos = prev.committedPath.length > 0
    ? prev.committedPath[prev.committedPath.length - 1]
    : carrier.position;

  const opponents = prev.pieces.filter(p => p.team !== carrier.team && !p.down).map(p => p.position);

  const passTarget = passTargetAt(carrierPos, carrier.pa, pos, opponents);
  const band = prev.passRangeKeys.get(receiverKey);
  // Out of range — passReceiverKeys is built from the same range map, so
  // this should be unreachable, but bail out rather than log a bogus roll.
  if (passTarget === null || !band) return prev;

  const catchTarget = catchTargetAt(pos, receiver.ag, opponents);

  const passProb  = successChance(passTarget);
  const catchProb = successChance(catchTarget);

  const prevCumProb = prev.actionLog.length > 0
    ? prev.actionLog[prev.actionLog.length - 1].cumulativeProb : 1;

  const afterPassCum  = prevCumProb * passProb;
  const afterCatchCum = afterPassCum * catchProb;

  const passEntry: ActionLogEntry = {
    kind: 'pass',
    pieceName: carrier.name,
    pieceRole: carrier.role ?? carrier.team,
    receiverName: receiver.name,
    receiverRole: receiver.role ?? receiver.team,
    from: carrierPos,
    to: pos,
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
    from: pos,
    to: pos,
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
}

/**
 * Declare a Block or Blitz. Blitz chooses its defender first, then allows
 * movement into contact; plain Block never moves and only offers adjacent
 * defenders.
 */
export function applyBlockAction(prev: GameState, pieceId: string, isBlitz: boolean): GameState {
  if (isBlitz && prev.blitzUsed) return prev;

  const attacker = prev.pieces.find(p => p.id === pieceId);
  if (!attacker || attacker.activated || attacker.down) return prev;

  if (isBlitz) {
    const targets = blitzTargetKeys(prev, attacker);
    if (targets.size === 0) return prev;

    return {
      // Movement stays locked until a defender is chosen, so start from an
      // empty reachable set.
      ...beginActivation(prev, attacker, attacker.ma, MAX_GFI, new Set()),
      pendingBlock: true,
      pendingBlockIsBlitz: true,
      blitzTargetId: null,
      isBlockTargeting: true,
      blockTargets: targets,
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
    ...beginActivation(prev, attacker, 0, 0, new Set()),
    pendingBlock: false,
    pendingBlockIsBlitz: false,
    blitzTargetId: null,
    isBlockTargeting: true,
    blockTargets: targets,
  };
}

/**
 * For a Blitz, the first defender click chooses the target and opens movement;
 * clicking that target again from an adjacent square performs the block. Plain
 * Block goes directly to the dice calculation.
 */
export function applyBlockTarget(prev: GameState, pos: Position): GameState {
  const defenderKey = key(pos);
  if (!prev.selectedPieceId) return prev;

  const attacker = prev.pieces.find(p => p.id === prev.selectedPieceId);
  const defender = prev.pieces.find(p => key(p.position) === defenderKey);
  if (!attacker || !defender || defender.team === attacker.team || defender.down) return prev;

  const choosingBlitzTarget = prev.pendingBlock
    && prev.pendingBlockIsBlitz
    && prev.blitzTargetId === null
    && prev.isBlockTargeting;

  if (choosingBlitzTarget) {
    if (!prev.blockTargets.has(defenderKey)) return prev;
    const { reachableKeys } = recomputeReachable(
      prev,
      attacker.id,
      attacker.position,
      attacker.ma,
      MAX_GFI,
    );
    return {
      ...prev,
      blitzTargetId: defender.id,
      isBlockTargeting: false,
      blockTargets: new Set(),
      reachableKeys,
    };
  }

  const executingBlitz = prev.pendingBlock
    && prev.pendingBlockIsBlitz
    && prev.blitzTargetId === defender.id;
  const executingPlainBlock = prev.isBlockTargeting && prev.blockTargets.has(defenderKey);
  if (!executingBlitz && !executingPlainBlock) return prev;

  const attackerPos = executingBlitz
    ? (prev.committedPath[prev.committedPath.length - 1] ?? prev.originPos ?? attacker.position)
    : attacker.position;
  if (!neighbours(attackerPos).some(p => key(p) === defenderKey)) return prev;

  // BB2020: the block itself costs one square of the Blitz's movement.
  // Without this a blitzing piece effectively got MA + 1.
  let remainingMa = prev.remainingMa;
  let remainingGfi = prev.remainingGfi;
  if (executingBlitz) {
    if (remainingMa > 0) remainingMa -= 1;
    else if (remainingGfi > 0) remainingGfi -= 1;
    else return prev; // no movement left to spend on the block
  }

  const pickedUpBall = prev.ballPosition !== null
    && prev.walkedSquares.some(p => key(p) === key(prev.ballPosition!));
  const pieces = prev.pieces.map(piece =>
    piece.id === attacker.id
      ? { ...piece, position: attackerPos, hasBall: piece.hasBall || pickedUpBall }
      : piece
  );
  const positionedAttacker = pieces.find(piece => piece.id === attacker.id)!;

  const attackerTeammates = pieces.filter(p => p.team === positionedAttacker.team)
    .map(p => ({ id: p.id, position: p.position, down: p.down }));
  const defenderTeammates = pieces.filter(p => p.team === defender.team)
    .map(p => ({ id: p.id, position: p.position, down: p.down }));

  const attackerAssists = countEligibleAssists(
    defender.position,
    attackerTeammates,
    positionedAttacker.id,
    defenderTeammates,
    defender.id,
  );
  const defenderAssists = countEligibleAssists(
    positionedAttacker.position,
    defenderTeammates,
    defender.id,
    attackerTeammates,
    positionedAttacker.id,
  );

  const { diceCount, picker } = blockDiceCount(positionedAttacker.st, attackerAssists, defender.st, defenderAssists);
  const outcomeProbs = blockOutcomeProbabilities(diceCount, picker);

  return {
    ...prev,
    pieces,
    ballPosition: pickedUpBall ? null : prev.ballPosition,
    originPos: attackerPos,
    committedPath: [],
    walkedSquares: [],
    remainingMa,
    remainingGfi,
    reachableKeys: new Set(),
    pathPreview: [],
    pendingBlock: false,
    isBlockTargeting: false,
    blockTargets: new Set(),
    blockChoice: {
      defenderId: defender.id,
      isBlitz: prev.pendingBlockIsBlitz,
      diceCount,
      picker,
      attackerAssists,
      defenderAssists,
      outcomeProbs,
    },
  };
}

export interface BlockSplitContext {
  attackerId: string;
  defenderId: string;
  isBlitz: boolean;
}

/**
 * Apply one board state from a block, **without folding any probability into
 * the log**. Under branching the split owns the block's probability — it is
 * derived from what each branch turns out to be worth — so the block entry is
 * logged at `actionProb: 1` and `cumulativeProb` carries only the ordinary
 * rolls. That is what lets a branch's segment probability be read straight back
 * off its log.
 *
 * The interim log shape reuses `BlockLogEntry` with the board state's faces as
 * `acceptedFaces`; the branch-tree log format is a later phase.
 */
export function applyBlockBoardState(
  prev: GameState,
  boardState: BlockBoardState,
  ctx: BlockSplitContext,
): GameState {
  const attacker = prev.pieces.find(p => p.id === ctx.attackerId);
  const defender = prev.pieces.find(p => p.id === ctx.defenderId);
  if (!attacker || !defender) return prev;

  const choice = prev.blockChoice;
  const cumulativeProb = prev.actionLog.length > 0
    ? prev.actionLog[prev.actionLog.length - 1].cumulativeProb : 1;

  const blockEntry: ActionLogEntry = {
    kind: 'block',
    isBlitz: ctx.isBlitz,
    pieceName: attacker.name,
    pieceRole: attacker.role ?? attacker.team,
    receiverName: defender.name,
    receiverRole: defender.role ?? defender.team,
    from: attacker.position,
    to: defender.position,
    diceCount: choice?.diceCount ?? 1,
    picker: choice?.picker ?? 'attacker',
    outcomeProbs: choice?.outcomeProbs ?? blockOutcomeProbabilities(1, 'attacker'),
    acceptedFaces: boardState.faces,
    resolvedFace: boardState.faces[0],
    actionProb: 1,
    cumulativeProb,
    dodgeTarget: null,
    isGfi: false,
  };

  const base = {
    ...prev,
    actionLog: [...prev.actionLog, blockEntry],
    blitzUsed: ctx.isBlitz ? true : prev.blitzUsed,
    blockChoice: null,
  };

  // Neither player is pushed: the defender either falls where it stands or the
  // block does nothing at all. Both leave the attacker upright.
  if (!boardState.defenderPushed) {
    const knocked = base.pieces.map(p => {
      if (p.id === defender.id) return { ...p, down: boardState.defenderFalls };
      if (p.id === attacker.id) return { ...p, activated: !ctx.isBlitz };
      return p;
    });
    const { pieces, ballPosition } = dropBallIfCarrying(
      knocked, base.ballPosition, boardState.defenderFalls ? [defender.id] : [],
    );
    const nextState = { ...base, pieces, ballPosition };
    return ctx.isBlitz
      ? resumeMovementAfterBlitz(nextState, pieces, attacker.id)
      : clearSelection(nextState);
  }

  const allPositions = base.pieces.map(p => p.position);
  const pushCandidates = pushBackCandidates(attacker.position, defender.position, allPositions);

  if (pushCandidates.length === 0) {
    // No legal square to push into — defender stays in place but still falls
    // per the board state (crowd-push mechanics are out of scope).
    const knocked = base.pieces.map(p => {
      if (p.id === defender.id) return { ...p, down: boardState.defenderFalls };
      if (p.id === attacker.id) return { ...p, activated: !ctx.isBlitz };
      return p;
    });
    const { pieces, ballPosition } = dropBallIfCarrying(
      knocked, base.ballPosition, boardState.defenderFalls ? [defender.id] : [],
    );
    const nextState = { ...base, pieces, ballPosition };
    return ctx.isBlitz
      ? resumeMovementAfterBlitz(nextState, pieces, attacker.id)
      : clearSelection(nextState);
  }

  // Which square, and whether to follow up, stay in-branch player choices.
  return {
    ...base,
    pushTargetKeys: new Set(pushCandidates.map(key)),
    pendingBlockResolution: {
      attackerId: attacker.id,
      defenderId: defender.id,
      resolvedFace: boardState.faces[0],
      defenderFalls: boardState.defenderFalls,
      defenderFrom: defender.position,
      offerFollowUp: true,
      isBlitz: ctx.isBlitz,
    },
  };
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
    setState(prev => applySquareHover(prev, { col, row }));
  }, []);

  const handleSquareLeave = useCallback(() => {
    setState(applySquareLeave);
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
    setState(prev => applyClick(prev, { col, row }));
  }, []);

  const handleCancelSelection = useCallback(() => {
    setState(applyCancelSelection);
  }, []);

  const handleResetMovement = useCallback(() => {
    setState(applyResetMovement);
  }, []);

  /**
   * Called when the player clicks "Hand Off" in the PieceMenu.
   * Selects the carrier for normal movement (same as "Move") but sets pendingHandoff.
   * When the player ends the activation, receiver targeting opens automatically.
   */
  const handleHandoffAction = useCallback((pieceId: string) => {
    setState(prev => applyHandoffAction(prev, pieceId));
  }, []);

  /**
   * Called when the player clicks a highlighted receiver square during handoff targeting.
   * Executes the handoff: logs the catch roll, transfers the ball, marks carrier activated.
   */
  const handleHandoffTarget = useCallback((col: number, row: number) => {
    setState(prev => applyHandoffTarget(prev, { col, row }));
  }, []);

  /**
   * Called when the player clicks "Pass" in the PieceMenu.
   * Selects the carrier for normal movement with pendingPass: true.
   * When the player ends activation, pass targeting opens.
   */
  const handlePassAction = useCallback((pieceId: string) => {
    setState(prev => applyPassAction(prev, pieceId));
  }, []);

  /**
   * Called when the player clicks a receiver square during pass targeting.
   * Logs pass roll + catch roll entries, transfers ball, marks carrier activated.
   */
  const handlePassTarget = useCallback((col: number, row: number) => {
    setState(prev => applyPassTarget(prev, { col, row }));
  }, []);

  /**
   * Called when the player clicks "Block"/"Blitz" in the PieceMenu.
   * Blitz chooses its defender first, then allows movement into contact. Plain
   * Block never moves and only offers adjacent defenders.
   */
  const handleBlockAction = useCallback((pieceId: string, isBlitz: boolean) => {
    setState(prev => applyBlockAction(prev, pieceId, isBlitz));
  }, []);

  /**
   * For a Blitz, the first defender click chooses the target and opens movement;
   * clicking that target again from an adjacent square performs the block.
   * Plain Block goes directly to the outcome calculation.
   */
  const handleBlockTarget = useCallback((col: number, row: number) => {
    setState(prev => applyBlockTarget(prev, { col, row }));
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

      const attacker = prev.pieces.find(p => p.id === prev.selectedPieceId);
      const defender = prev.pieces.find(p => p.id === defenderId);
      if (!attacker || !defender) return prev;

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
        const knocked = prev.pieces.map(p =>
          p.id === attacker.id ? { ...p, down: true, activated: true } : p
        );
        const { pieces, ballPosition } = dropBallIfCarrying(knocked, prev.ballPosition, [attacker.id]);
        return clearSelection({
          ...prev, pieces, ballPosition, actionLog: newActionLog, pendingProb: newPendingProb,
          blitzUsed: newBlitzUsed, blockChoice: null,
        });
      }

      if (resolvedFace === 'both-down') {
        const attackerHasBlockSkill = attacker.skills.includes('Block');
        const attackerHasWrestleSkill = attacker.skills.includes('Wrestle');
        const defenderHasBlockSkill = defender.skills.includes('Block');
        const attackerFalls = !attackerHasBlockSkill;
        const wrestleIsUsed = attackerHasWrestleSkill && !attackerHasBlockSkill;
        const defenderFalls = wrestleIsUsed || !defenderHasBlockSkill;
        const knocked = prev.pieces.map(p => {
          if (p.id === attacker.id) return { ...p, down: attackerFalls, activated: !isBlitz || attackerFalls };
          if (p.id === defender.id) return { ...p, down: defenderFalls };
          return p;
        });
        const fallen = [
          ...(attackerFalls ? [attacker.id] : []),
          ...(defenderFalls ? [defender.id] : []),
        ];
        const { pieces, ballPosition } = dropBallIfCarrying(knocked, prev.ballPosition, fallen);
        const nextState = {
          ...prev, pieces, ballPosition, actionLog: newActionLog, pendingProb: newPendingProb,
          blitzUsed: newBlitzUsed, blockChoice: null,
        };
        return isBlitz && !attackerFalls
          ? resumeMovementAfterBlitz(nextState, pieces, attacker.id)
          : clearSelection(nextState);
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
        const knocked = prev.pieces.map(p => {
          if (p.id === defender.id) return { ...p, down: defenderFalls };
          if (p.id === attacker.id) return { ...p, activated: !isBlitz };
          return p;
        });
        const { pieces, ballPosition } = dropBallIfCarrying(
          knocked, prev.ballPosition, defenderFalls ? [defender.id] : [],
        );
        const nextState = {
          ...prev, pieces, ballPosition, actionLog: newActionLog, pendingProb: newPendingProb,
          blitzUsed: newBlitzUsed, blockChoice: null,
        };
        return isBlitz
          ? resumeMovementAfterBlitz(nextState, pieces, attacker.id)
          : clearSelection(nextState);
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
          // The attacker stays standing for all three push-back outcomes
          // (push, defender-stumbles, defender-down), so a follow-up into
          // the vacated square is always offered.
          offerFollowUp: true,
          isBlitz,
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
    setState(prev => applyPushChoice(prev, { col, row }, followUp));
  }, []);

  return {
    state, setState, handleSquareClick, handleSquareHover, handleSquareLeave,
    handleCancelSelection, handleResetMovement,
    handleHandoffAction, handleHandoffTarget, handlePassAction, handlePassTarget,
    handleBlockAction, handleBlockTarget, handleBlockOutcomeChoice, handlePushChoice,
  };
}

/**
 * Standing opponents a Blitz could actually reach contact with, given the
 * attacker's movement. Exported so the piece menu can grey out Blitz when the
 * answer is "none" instead of offering a button that does nothing.
 */
export function blitzTargetKeys(state: GameState, attacker: PlayerPiece): Set<string> {
  const { reachableKeys } = recomputeReachable(
    state, attacker.id, attacker.position, attacker.ma, MAX_GFI,
  );
  const targets = new Set<string>();
  for (const defender of state.pieces) {
    if (defender.team === attacker.team || defender.down) continue;
    const canReachContact = neighbours(defender.position).some(pos =>
      key(pos) === key(attacker.position) || reachableKeys.has(key(pos))
    );
    if (canReachContact) targets.add(key(defender.position));
  }
  return targets;
}

/**
 * Whether a piece has any legal Pass at all, given its remaining movement.
 * Exported so the piece menu can grey out Pass when every teammate is out of
 * range from every square the carrier could throw from — checking only
 * "does this piece carry the ball" left the menu offering a Pass that opened
 * targeting with zero valid receivers.
 */
export function passActionAvailability(state: GameState, carrier: PlayerPiece): boolean {
  if (carrier.activated || carrier.down || state.passUsed) return false;
  if (!carrier.hasBall && state.ballPosition === null) return false;

  const { reachableKeys } = recomputeReachable(
    state, carrier.id, carrier.position, carrier.ma, MAX_GFI,
  );
  const throwFromKeys = new Set(reachableKeys);
  throwFromKeys.add(key(carrier.position));

  return state.pieces.some(piece => {
    if (piece.team !== carrier.team || piece.id === carrier.id || piece.hasBall || piece.down) return false;
    for (const throwFromKey of throwFromKeys) {
      if (rangeBandForPass(fromKey(throwFromKey), piece.position)) return true;
    }
    return false;
  });
}
