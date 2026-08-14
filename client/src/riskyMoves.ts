import type { ActionLogEntry, RiskyMove } from './types';

/** Build the risky-moves list + summary stats from a completed puzzle's action log. */
export function summarizeActionLog(actionLog: ActionLogEntry[]) {
  const cumulativeProb = actionLog.length > 0
    ? actionLog[actionLog.length - 1].cumulativeProb
    : 1;
  const riskyMoves = actionLog.filter(e =>
    e.kind === 'handoff' || e.kind === 'pass' || e.kind === 'pass-catch' || e.kind === 'block' ||
    e.dodgeTarget !== null || e.isGfi || (e.kind === 'move' && !!e.pickupTarget)
  );
  const diceCount = riskyMoves.length;
  const moves: RiskyMove[] = riskyMoves.map(e => {
    if (e.kind === 'handoff') {
      return {
        pieceName: e.pieceName, pieceRole: e.pieceRole,
        receiverName: e.receiverName, receiverRole: e.receiverRole,
        from: e.from, to: e.to,
        dodgeTarget: null, isGfi: false,
        catchTarget: e.catchTarget,
        actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
      };
    }
    if (e.kind === 'pass') {
      return {
        pieceName: e.pieceName, pieceRole: e.pieceRole,
        receiverName: e.receiverName, receiverRole: e.receiverRole,
        from: e.from, to: e.to,
        dodgeTarget: null, isGfi: false,
        passTarget: e.passTarget, rangeBand: e.rangeBand,
        actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
      };
    }
    if (e.kind === 'pass-catch') {
      return {
        pieceName: e.pieceName, pieceRole: e.pieceRole,
        from: e.from, to: e.to,
        dodgeTarget: null, isGfi: false,
        catchTarget: e.catchTarget,
        actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
      };
    }
    if (e.kind === 'block') {
      return {
        pieceName: e.pieceName, pieceRole: e.pieceRole,
        receiverName: e.receiverName, receiverRole: e.receiverRole,
        from: e.from, to: e.to,
        dodgeTarget: null, isGfi: false,
        isBlitz: e.isBlitz, diceCount: e.diceCount, picker: e.picker,
        acceptedFaces: e.acceptedFaces, resolvedFace: e.resolvedFace,
        actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
      };
    }
    return {
      pieceName: e.pieceName, pieceRole: e.pieceRole,
      from: e.from, to: e.to,
      dodgeTarget: e.dodgeTarget, isGfi: e.isGfi,
      dodgeSkillReroll: e.dodgeSkillReroll,
      pickupTarget: e.pickupTarget ?? null,
      actionProb: e.actionProb, cumulativeProb: e.cumulativeProb,
    };
  });
  return { cumulativeProb, diceCount, moves };
}
