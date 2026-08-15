import { describe, expect, it } from 'vitest';
import type { GameState, PlayerPiece } from './types';
import { blockOutcomeProbabilities } from './bfs';
import { applyClick } from './useGameState';
import { makeState, humanBlocker, orcBlocker, humanThrower } from './test/gameState';
import { validateScoreSubmission } from '../../shared/scoreValidation.js';
import {
  branchPath,
  branchStrip,
  cancelActivation,
  chooseBlockTarget,
  chooseHandoffTarget,
  choosePush,
  clickSquare,
  concedeBranch,
  declareBlock,
  declareHandoff,
  ghostPieces,
  isBlockPending,
  isRunComplete,
  runSummary,
  selectBranch,
  splitOnBlock,
  startRun,
  toSubmissionTree,
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
      attackerAssists: 0,
      defenderAssists: 0,
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

  it('records who was blocking whom on the split, not just the dice', () => {
    const run = blockRun();
    const split = Object.values(run.lines).find(l => l.split)!.split!;

    expect(split.attackerName).toBe('Aldric Swiftfoot');
    expect(split.defenderName).toBe('Grukk Ironjaw');
  });
});

describe('branchPath', () => {
  it('is just the line label before anything has split', () => {
    const run = startRun(declaredBlock());
    expect(branchPath(run, run.rootId)).toBe('Main');
  });

  it('ties a leaf to the specific block that created it', () => {
    const run = blockRun();
    const pushed = branchStrip(run).find(e => e.label === 'Pushed')!;

    // A bare "Pushed" says nothing about which block produced it; the path
    // names the attacker and defender the same way the pre-roll dialog does.
    expect(branchPath(run, pushed.id)).toBe('Aldric Swiftfoot ⚔ Grukk Ironjaw: Pushed');
  });

  it('agrees with what branchStrip reports for the same line', () => {
    const run = blockRun();
    for (const entry of branchStrip(run)) {
      expect(branchPath(run, entry.id)).toBe(entry.path);
    }
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

describe('declaring a block waits for a roll', () => {
  // Built from a plain board via declareBlock + chooseBlockTarget, unlike
  // blockRun() above which starts from a blockChoice already set — this is
  // what App actually drives the pitch through before the split.
  function declaredNotSplit(): BranchRun {
    const attacker = humanBlocker({ id: 'attacker', position: { col: 7, row: 10 }, skills: ['Block'] });
    const defender = orcBlocker({ id: 'defender', position: { col: 7, row: 9 } });
    let run = startRun(applyClick(makeState([attacker, defender]), { col: 7, row: 10 }));
    run = declareBlock(run, 'attacker', false);
    return chooseBlockTarget(run, { col: 7, row: 9 });
  }

  it('sets blockChoice without splitting the run', () => {
    const run = declaredNotSplit();

    // The player has picked a target and seen the dice, but nothing has
    // rolled yet — there is still exactly one line, not three.
    expect(isBlockPending(run)).toBe(true);
    expect(viewedLine(run).state.blockChoice).not.toBeNull();
    expect(branchStrip(run)).toHaveLength(1);
  });

  it('splits into branches once the roll is accepted', () => {
    const run = splitOnBlock(declaredNotSplit());

    expect(isBlockPending(run)).toBe(false);
    expect(branchStrip(run)).toHaveLength(3);
  });

  it('cancelling the declared block clears it without ever splitting', () => {
    const run = cancelActivation(declaredNotSplit());

    expect(viewedLine(run).state.blockChoice).toBeNull();
    expect(viewedLine(run).state.selectedPieceId).toBeNull();
    expect(branchStrip(run)).toHaveLength(1);
  });
});

describe('a second block', () => {
  /**
   * A separate pairing far from the first, so the two blocks are independent.
   * Named differently from blockRun()'s attacker/defender so path tests below
   * can tell the two blocks apart by name, not just by position.
   */
  const attacker2 = () =>
    humanBlocker({
      id: 'attacker2', name: 'Cedric Linebreaker', position: { col: 2, row: 10 }, skills: ['Block'],
    });
  const defender2 = () =>
    orcBlocker({ id: 'defender2', name: 'Muzgash Skullkrak', position: { col: 2, row: 9 } });
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

  it('ties every leaf back to both blocks that produced it, not just the nearer one', () => {
    const run = twoBlocks();
    const paths = branchStrip(run).map(e => e.path);

    // Nine leaves, but each bare state name ("Pushed", "Down in place",
    // "Pushed + Down") recurs three times over — once per outcome of the
    // first block. Only the full path is actually unique per leaf.
    expect(new Set(paths).size).toBe(9);
    expect(paths.every(p => p.includes('Aldric Swiftfoot ⚔ Grukk Ironjaw:'))).toBe(true);
    expect(paths.every(p => p.includes('Cedric Linebreaker ⚔ Muzgash Skullkrak:'))).toBe(true);
  });
});

describe('submission tree', () => {
  const carrier = () => humanThrower({ id: 'carrier', position: { col: 5, row: 1 } });

  function scoredRun(): BranchRun {
    let run = choosePush(blockRun([carrier()]), { col: 7, row: 8 }, false);
    run = clickSquare(run, { col: 5, row: 1 });
    run = clickSquare(run, { col: 5, row: 0 });
    return run;
  }

  /** Submit exactly as the app would, and let the real validator judge it. */
  function submit(run: BranchRun, overrides: Record<string, unknown> = {}) {
    const summary = runSummary(run);
    return validateScoreSubmission({
      name: 'Coach',
      probability: summary.score,
      diceCount: summary.expectedDice,
      tree: toSubmissionTree(run),
      ...overrides,
    });
  }

  it('is accepted by the server validator with the score the client computed', () => {
    const run = scoredRun();
    const validated = submit(run);

    // The single most important guarantee in the whole feature: the number the
    // player is shown is the number the leaderboard recomputes independently.
    expect(validated.probability).toBeCloseTo(runSummary(run).score, 12);
    expect(validated.branching).toBe(true);
  });

  it('round-trips a run with a conceded branch', () => {
    const run = scoredRun();
    const inPlace = branchStrip(run).find(e => e.label === 'Down in place')!;
    const conceded = concedeBranch(run, inPlace.id);

    expect(submit(conceded).probability).toBeCloseTo(runSummary(conceded).score, 12);
  });

  it('round-trips a run with two blocks in it', () => {
    const attacker2 = humanBlocker({
      id: 'attacker2', position: { col: 2, row: 10 }, skills: ['Block'],
    });
    const defender2 = orcBlocker({ id: 'defender2', position: { col: 2, row: 9 } });

    let run = choosePush(blockRun([attacker2, defender2, carrier()]), { col: 7, row: 8 }, false);
    run = declareBlock(run, 'attacker2', false);
    run = chooseBlockTarget(run, { col: 2, row: 9 });
    run = splitOnBlock(run);
    run = choosePush(run, { col: 2, row: 8 }, false);
    run = clickSquare(run, { col: 5, row: 1 });
    run = clickSquare(run, { col: 5, row: 0 });

    const summary = runSummary(run);
    expect(summary.score).toBeCloseTo((5 / 6) ** 2, 12);
    expect(submit(run).probability).toBeCloseTo(summary.score, 12);
  });

  it('accounts for every die face in each block it submits', () => {
    const block = toSubmissionTree(scoredRun()).block!;
    const live = block.faceCounts.reduce((a, b) => a + b, 0);

    expect(live + block.deadFaceCount).toBe(6);
    expect(block.children).toHaveLength(block.faceCounts.length);
  });

  it('serialises a branch that is still open as conceded', () => {
    // Half-finished runs must never be scored as if the unauthored branches
    // would have worked out.
    const open = blockRun();
    const tree = toSubmissionTree(open);

    expect(tree.block!.children.every(child => child.outcome === 'conceded')).toBe(true);
  });

  it('is rejected when the claimed probability is raised', () => {
    const run = scoredRun();
    expect(() => submit(run, { probability: 0.99 }))
      .toThrow(/does not match its branch tree/);
  });
});

describe('ghostPieces', () => {
  it('reports only the pieces that actually differ from the viewed board', () => {
    const run = choosePush(blockRun(), { col: 7, row: 8 }, false);
    const ghosts = ghostPieces(run);

    // The attacker stands still in every branch; only the defender moves or
    // falls, so it is the only thing worth drawing over the board.
    expect(ghosts.every(g => g.pieceId === 'defender')).toBe(true);
    expect(ghosts.length).toBeGreaterThan(0);
  });

  it('places a ghost on the square the defender holds in another branch', () => {
    const run = choosePush(blockRun(), { col: 7, row: 8 }, false);
    const ghosts = ghostPieces(run);

    // Viewed branch is "Pushed + Down" at (7,8); "Down in place" keeps (7,9).
    const inPlace = ghosts.find(g => g.position.col === 7 && g.position.row === 9);
    // The label is the full block path now, not the bare state name — a
    // ghost tooltip has to say which block put a piece where.
    expect(inPlace?.labels).toContain('Aldric Swiftfoot ⚔ Grukk Ironjaw: Down in place');
  });

  it('distinguishes a standing ghost from a prone one on the same square', () => {
    const run = choosePush(blockRun(), { col: 7, row: 8 }, false);
    const standing = ghostPieces(run).find(g =>
      g.position.col === 7 && g.position.row === 8 && !g.down);

    // "Pushed" leaves the defender upright on the very square the viewed
    // branch has it lying on — same square, different board.
    expect(standing?.labels).toContain('Aldric Swiftfoot ⚔ Grukk Ironjaw: Pushed');
  });

  it('returns nothing once every branch agrees', () => {
    // Before any block there is only one board, so there is nothing to ghost.
    expect(ghostPieces(startRun(declaredBlock()))).toEqual([]);
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
