import { describe, expect, it } from 'vitest';
import type { GameState, PlayerPiece } from './types';
import { blockOutcomeProbabilities } from './bfs';
import { applyClick } from './useGameState';
import { makeState, humanBlocker, orcBlocker, humanThrower } from './test/gameState';
import {
  branchStrip,
  cancelActivation,
  chooseBlockTarget,
  chooseHandoffTarget,
  choosePush,
  clickSquare,
  concedeBranch,
  declareBlock,
  declareHandoff,
  isRunComplete,
  runSummary,
  selectBranch,
  splitOnBlock,
  startRun,
  unresolvedLines,
  viewedLine,
  type BranchRun,
} from './branchRun';

/**
 * A human with Block standing over an orc, with the block already declared —
 * i.e. exactly the point where the outcome checklist used to open.
 *
 * Equal ST means one die, so each board state's weight is just its face count
 * and the numbers in these tests are exact sixths.
 */
function declaredBlock(extraPieces: PlayerPiece[] = []): GameState {
  const attacker = humanBlocker({ id: 'attacker', position: { col: 7, row: 10 }, skills: ['Block'] });
  const defender = orcBlocker({ id: 'defender', position: { col: 7, row: 9 } });
  const selected = applyClick(makeState([attacker, defender, ...extraPieces]), { col: 7, row: 10 });

  return {
    ...selected,
    blockChoice: {
      defenderId: 'defender',
      isBlitz: false,
      diceCount: 1,
      picker: 'attacker',
      outcomeProbs: blockOutcomeProbabilities(1, 'attacker'),
    },
  };
}

function blockRun(extraPieces: PlayerPiece[] = []): BranchRun {
  return splitOnBlock(startRun(declaredBlock(extraPieces)));
}

function labels(run: BranchRun): string[] {
  return branchStrip(run).map(entry => entry.label);
}

function entry(run: BranchRun, label: string) {
  return branchStrip(run).find(e => e.label === label);
}

describe('splitOnBlock', () => {
  it('replaces the checklist with one branch per live board state', () => {
    const run = blockRun();

    expect(labels(run)).toEqual(['Pushed + Down', 'Down in place', 'Pushed']);
    // The attacker falling is never materialised — there is nothing to author.
    expect(labels(run)).not.toContain('Attacker Down');
  });

  it('leaves the player in a branch so play just continues', () => {
    const run = blockRun();
    expect(viewedLine(run).label).toBe('Pushed + Down');
    expect(viewedLine(run).state.blockChoice).toBeNull();
  });

  it('weights the branches by face count, with the dead face accounted for', () => {
    const summary = runSummary(blockRun());
    const run = blockRun();

    expect(entry(run, 'Pushed + Down')?.weight).toBeCloseTo(2 / 6, 12);
    expect(entry(run, 'Down in place')?.weight).toBeCloseTo(1 / 6, 12);
    expect(entry(run, 'Pushed')?.weight).toBeCloseTo(2 / 6, 12);
    expect(summary.deadWeight).toBeCloseTo(1 / 6, 12);
  });

  it('pushes the defender in the pushed branches only', () => {
    const run = blockRun();
    const byLabel = (label: string) =>
      Object.values(run.lines).find(line => line.label === label)!;

    // Down in place keeps the square; the pushed branches owe a push choice.
    expect(byLabel('Down in place').state.pendingBlockResolution).toBeNull();
    expect(byLabel('Down in place').state.pieces.find(p => p.id === 'defender'))
      .toMatchObject({ position: { col: 7, row: 9 }, down: true });
    expect(byLabel('Pushed + Down').state.pendingBlockResolution).not.toBeNull();
    expect(byLabel('Pushed').state.pendingBlockResolution).not.toBeNull();
  });

  it('does not charge the block against the branch probability', () => {
    // The split owns the block's odds; the log must keep carrying only the
    // ordinary rolls, or the segment probability would be double-counted.
    const run = blockRun();
    const line = viewedLine(run);
    expect(line.state.actionLog.at(-1)).toMatchObject({ kind: 'block', actionProb: 1 });
    expect(line.startCumProb).toBe(1);
  });
});

describe('lockstep authoring', () => {
  /** A spare human who can move after the block resolves. */
  const runner = () => humanBlocker({ id: 'runner', position: { col: 6, row: 10 } });

  it('resolves the push without flagging the branch that was never pushed', () => {
    const pushed = choosePush(blockRun([runner()]), { col: 7, row: 8 }, false);

    // "Down in place" has no push to make. That is not a divergence, so it
    // must pass through rather than being sent to the naughty step.
    expect(entry(pushed, 'Down in place')?.status).toBe('authoring');
    expect(branchStrip(pushed).every(e => e.status !== 'needs-attention')).toBe(true);
  });

  it('carries one authored move into every branch that can follow it', () => {
    let run = choosePush(blockRun([runner()]), { col: 7, row: 8 }, false);
    run = clickSquare(run, { col: 6, row: 10 }); // select the runner
    run = clickSquare(run, { col: 6, row: 9 });  // step forward

    for (const line of Object.values(run.lines)) {
      if (line.split) continue;
      expect(line.state.committedPath).toHaveLength(1);
    }
    expect(branchStrip(run).every(e => e.status !== 'needs-attention')).toBe(true);
  });

  it('flags only the branch where the move is no longer legal', () => {
    let run = choosePush(blockRun([runner()]), { col: 7, row: 8 }, false);
    run = clickSquare(run, { col: 6, row: 10 });
    // (7,9) is the defender's original square: vacated in the pushed branches,
    // still occupied by the prone defender in "Down in place".
    run = clickSquare(run, { col: 7, row: 9 });

    expect(entry(run, 'Down in place')?.status).toBe('needs-attention');
    expect(entry(run, 'Pushed + Down')?.status).toBe('authoring');
    expect(entry(run, 'Pushed')?.status).toBe('authoring');
  });

  it('stops replaying into a branch once it has diverged', () => {
    let run = choosePush(blockRun([runner()]), { col: 7, row: 8 }, false);
    run = clickSquare(run, { col: 6, row: 10 });
    run = clickSquare(run, { col: 7, row: 9 });

    const divergedBefore = Object.values(run.lines).find(l => l.label === 'Down in place')!;
    run = clickSquare(run, { col: 7, row: 8 });
    const divergedAfter = Object.values(run.lines).find(l => l.label === 'Down in place')!;

    // Its board is untouched by anything authored after the divergence, so the
    // player picks it up exactly where their plan actually broke.
    expect(divergedAfter.state).toBe(divergedBefore.state);
  });

  it('clears the flag when the player opens the branch to deal with it', () => {
    let run = choosePush(blockRun([runner()]), { col: 7, row: 8 }, false);
    run = clickSquare(run, { col: 6, row: 10 });
    run = clickSquare(run, { col: 7, row: 9 });

    const flagged = branchStrip(run).find(e => e.status === 'needs-attention')!;
    run = selectBranch(run, flagged.id);

    expect(viewedLine(run).id).toBe(flagged.id);
    expect(entry(run, 'Down in place')?.status).toBe('authoring');
  });

  it('rewinds an activation across the whole lockstep group', () => {
    let run = choosePush(blockRun([runner()]), { col: 7, row: 8 }, false);
    run = clickSquare(run, { col: 6, row: 10 });
    run = clickSquare(run, { col: 6, row: 9 });
    run = cancelActivation(run);

    for (const line of Object.values(run.lines)) {
      if (line.split) continue;
      expect(line.state.selectedPieceId).toBeNull();
      expect(line.state.committedPath).toEqual([]);
      expect(line.state.pieces.find(p => p.id === 'runner')?.position).toEqual({ col: 6, row: 10 });
    }
  });
});

describe('declarations across a group', () => {
  /** Ball carrier next to the block, with a receiver just past the defender. */
  const carrier = () => humanThrower({ id: 'carrier', position: { col: 8, row: 9 } });
  const receiver = () => humanBlocker({ id: 'receiver', position: { col: 8, row: 8 } });

  function handedOff(): BranchRun {
    let run = choosePush(blockRun([carrier(), receiver()]), { col: 7, row: 8 }, false);
    run = declareHandoff(run, 'carrier');
    run = clickSquare(run, { col: 8, row: 9 }); // end activation, opening targeting
    return chooseHandoffTarget(run, { col: 8, row: 8 });
  }

  function catchTargetIn(run: BranchRun, label: string): number | undefined {
    const line = Object.values(run.lines).find(l => l.label === label && !l.split);
    const entry = line?.state.actionLog.find(e => e.kind === 'handoff');
    return entry && 'catchTarget' in entry ? entry.catchTarget : undefined;
  }

  it('recomputes catch targets per branch instead of copying the authored roll', () => {
    const run = handedOff();

    // Only "Pushed" leaves a defender standing next to the receiver, so only
    // that branch's catch is marked. Same click, three different rolls.
    const pushed = catchTargetIn(run, 'Pushed')!;
    const pushedDown = catchTargetIn(run, 'Pushed + Down')!;
    const inPlace = catchTargetIn(run, 'Down in place')!;

    expect(pushed).toBeGreaterThan(pushedDown);
    expect(pushedDown).toBe(inPlace);
  });

  it('costs the marked branch more probability off one authored hand off', () => {
    const run = handedOff();

    // Both branches are reached on two faces of six, so their weights differ
    // only by what the hand off cost — dearer where the defender is standing.
    expect(entry(run, 'Pushed')!.weight)
      .toBeLessThan(entry(run, 'Pushed + Down')!.weight);
  });

  it('flags branches where the declared action is not available', () => {
    // This attacker is only ever adjacent to a *standing* defender in the
    // "Pushed" branch; elsewhere the defender is prone and cannot be blocked.
    const opportunist = humanBlocker({ id: 'opportunist', position: { col: 6, row: 7 } });
    let run = choosePush(blockRun([opportunist]), { col: 7, row: 8 }, false);

    // Author from the one branch where the block is legal: an action illegal on
    // the viewed board is simply not available, so nothing would happen at all.
    run = selectBranch(run, entry(run, 'Pushed')!.id);
    run = declareBlock(run, 'opportunist', false);

    expect(entry(run, 'Pushed')?.status).toBe('authoring');
    expect(entry(run, 'Pushed + Down')?.status).toBe('needs-attention');
    expect(entry(run, 'Down in place')?.status).toBe('needs-attention');
  });
});

describe('a second block', () => {
  /** A separate pairing far from the first, so the two blocks are independent. */
  const attacker2 = () =>
    humanBlocker({ id: 'attacker2', position: { col: 2, row: 10 }, skills: ['Block'] });
  const defender2 = () => orcBlocker({ id: 'defender2', position: { col: 2, row: 9 } });
  const carrier = () => humanThrower({ id: 'carrier', position: { col: 5, row: 1 } });

  function twoBlocks(): BranchRun {
    let run = choosePush(blockRun([attacker2(), defender2(), carrier()]), { col: 7, row: 8 }, false);
    run = declareBlock(run, 'attacker2', false);
    run = chooseBlockTarget(run, { col: 2, row: 9 });
    run = splitOnBlock(run);
    return choosePush(run, { col: 2, row: 8 }, false);
  }

  it('splits every branch of the group at once', () => {
    const run = twoBlocks();

    // Three boards from the first block, each forking into three again.
    expect(branchStrip(run)).toHaveLength(9);
  });

  it('keeps all nine branches in one lockstep group', () => {
    let run = twoBlocks();
    run = clickSquare(run, { col: 5, row: 1 });
    run = clickSquare(run, { col: 5, row: 0 });

    // One authored walk-in still serves every branch, which is the whole reason
    // multi-block puzzles stay playable.
    expect(branchStrip(run).every(e => e.status === 'scored')).toBe(true);
    expect(isRunComplete(run)).toBe(true);
  });

  it('compounds the two blocks into one honest number', () => {
    let run = twoBlocks();
    run = clickSquare(run, { col: 5, row: 1 });
    run = clickSquare(run, { col: 5, row: 0 });

    const summary = runSummary(run);
    // Each block survives 5 faces in 6, and they are independent.
    expect(summary.score).toBeCloseTo((5 / 6) ** 2, 12);
    expect(summary.deadWeight).toBeCloseTo(1 - (5 / 6) ** 2, 12);
  });

  it('counts the dice from both blocks', () => {
    let run = twoBlocks();
    run = clickSquare(run, { col: 5, row: 1 });
    run = clickSquare(run, { col: 5, row: 0 });

    expect(runSummary(run).expectedDice).toBeCloseTo(2, 12);
  });
});

describe('scoring a run', () => {
  /** A carrier one step from the end zone, unaffected by the block. */
  const carrier = () => humanThrower({ id: 'carrier', position: { col: 5, row: 1 } });

  function scoredRun(): BranchRun {
    let run = choosePush(blockRun([carrier()]), { col: 7, row: 8 }, false);
    run = clickSquare(run, { col: 5, row: 1 }); // select the carrier
    run = clickSquare(run, { col: 5, row: 0 }); // walk it in
    return run;
  }

  it('scores every branch that reached the end zone', () => {
    const run = scoredRun();

    // The run only loses the die face that puts the attacker down; every board
    // state the block can leave behind still lets the carrier walk in.
    expect(runSummary(run).score).toBeCloseTo(5 / 6, 12);
    expect(branchStrip(run).every(e => e.status === 'scored')).toBe(true);
    expect(isRunComplete(run)).toBe(true);
  });

  it('charges a conceded branch its full weight', () => {
    const run = scoredRun();
    const inPlace = branchStrip(run).find(e => e.label === 'Down in place')!;

    const conceded = concedeBranch(run, inPlace.id);

    expect(runSummary(conceded).score).toBeCloseTo(4 / 6, 12);
    expect(entry(conceded, 'Down in place')?.status).toBe('conceded');
  });

  it('accounts for every scrap of probability at all times', () => {
    for (const run of [blockRun(), scoredRun()]) {
      const { score, deadWeight, failedRollWeight, unresolvedWeight } = runSummary(run);
      expect(score + deadWeight + failedRollWeight + unresolvedWeight).toBeCloseTo(1, 12);
    }
  });

  it('blocks submission until every branch is resolved', () => {
    const open = blockRun();
    expect(isRunComplete(open)).toBe(false);
    expect(unresolvedLines(open)).toHaveLength(3);

    // Conceding is one click and costs no authoring — it is a legitimate way
    // to finish a run, it just costs the branch's weight.
    const allConceded = branchStrip(open)
      .reduce((run, e) => concedeBranch(run, e.id), open);

    expect(isRunComplete(allConceded)).toBe(true);
    expect(runSummary(allConceded).score).toBe(0);
  });

  it('reports a branch value independently of how likely it is', () => {
    const run = scoredRun();
    const pushed = entry(run, 'Pushed')!;

    // Conditional on getting here, this branch scores outright.
    expect(pushed.value).toBeCloseTo(1, 12);
    expect(pushed.weight).toBeCloseTo(2 / 6, 12);
  });
});

