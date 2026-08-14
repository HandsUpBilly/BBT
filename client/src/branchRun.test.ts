import { describe, expect, it } from 'vitest';
import type { GameState, PlayerPiece } from './types';
import { blockOutcomeProbabilities } from './bfs';
import { applyClick } from './useGameState';
import { makeState, humanBlocker, orcBlocker, humanThrower } from './test/gameState';
import {
  branchStrip,
  cancelActivation,
  choosePush,
  clickSquare,
  concedeBranch,
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

